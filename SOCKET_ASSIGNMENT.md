# Flux Socket.IO - Attribution des conversations

Ce memo decrypte l'algorithme d'attribution des messages cote back-end. Il peut etre partage tel quel avec l'equipe front pour adapter l'IHM.

## 1. Vocabulaire
- **Conversation** : lien client <-> girl (table `Conversations`).
- **Admin** : operateur humain qui repond pour une girl.
- **Message** : entree de la table `Messages` (`sender_type` = `client`, `girl` ou `system`).
- **Assignment** : conversation confiee temporairement a un admin lorsqu'un client envoie un nouveau message.

## 2. Nouvelles donnees persistees
### Table `ConversationAdminStats`
| colonne | description |
| --- | --- |
| `conversation_id` | identifiant de la conversation |
| `admin_id` | identifiant de l'admin |
| `message_count` | nombre de messages envoyes par cet admin dans la conversation |
| `last_message_at` | horodatage du dernier message de cet admin |

Cette table est alimentee via `incrementAdminParticipation(conversationId, adminId)` des que l'admin repond :
1. incrementation ou creation du compteur `(conversation_id, admin_id)`,
2. mise a jour de `Conversations.assigned_admin_id` avec l'admin actif.

### Messages
Pour chaque message emis par un admin :
- `sender_type = "girl"`,
- `sender_id = admin_id`,
- le service `getLastMessagesForConversation` expose aussi `sender_admin_id` pour faciliter l'affichage cote front.

## 3. Evenements Socket.IO exposes
- `register_admin`: appele par le front au login. Si le compte est deja actif, la nouvelle connexion recoit immediatement `force_logout` (`reason: "max_socket_limit"`) et est fermee; la premiere session reste active.
- `new_message_for_admin`: payload complet d'une conversation client -> admin (voir section 6).
- `admin_response`: a emettre lorsque l'admin prend en charge le message (juste apres avoir repondu). Cela libere l'assignation server.
- `force_logout`: emis vers la connexion refusee lorsqu'une double connexion est detectee pour le meme admin (`reason: "max_socket_limit"`).

## 4. Algorithme d'attribution (handleClientMessage)
1. **Hydratation** : recuperation de la conversation, du client, de la girl, des derniers messages et des meta locales (`pendingMessages`).
2. **Assignment existant** : si la conversation est deja confiee a un admin encore connecte, le message est renvoye tel quel (`isUpdate = true`).
3. **Admin precedent** : si `assigned_admin_id` est disponible et sous la limite, il reste prioritaire.
4. **Classement par points** : on recupere `ConversationAdminStats` tries par `message_count DESC` puis `last_message_at DESC`. Les admins eligibles doivent :
   - etre connectes (socket actif),
   - avoir moins de 3 conversations en attente,
   - en cas d'egalite exacte, un admin est choisi au hasard dans le groupe.
5. **Fallback** :
   - si aucun admin prioritaire n'est dispo, on cherche tous les admins connectes sous la limite et on en selectionne un dans le groupe le moins charge (tirage au sort en cas d'egalite).
   - si la liste est vide, l'attribution est differree; le message reste en memoire jusqu'a ce qu'un admin apparaisse.
   - si des admins existent mais ont deja echoue (timeout recent), on retente avec eux en dernier recours pour eviter un blocage quand un seul operateur est connecte.

## 5. Contraintes temporelles et de capacite
- **Limite** : `MAX_CONVERSATIONS_PER_ADMIN = 3`. Un admin ne peut pas recevoir plus de trois conversations en attente simultanement.
- **Timeout** : `ASSIGNMENT_TIMEOUT_MS = 10 minutes`. Si l'admin n'a pas repondu apres 10 minutes :
  1. l'assignation est annulee,
  2. la conversation retourne dans la file,
  3. un autre admin est choisi selon les regles ci-dessus (random dans les ex aequo).
- **Memoire locale** :
  - `attemptedAdminIds` garde la liste des admins deja sollicites pour ce message,
  - `recentlyTimedOutAdmins` enregistre ceux qui ont laisse expirer le delai.
- **Retour client > 24 h** : si un client se reconnecte plus de 24 heures apres sa derniere visite et que la conversation attend encore sa reponse (dernier message emis par une girl), elle est remise en file avec un flag `followUp`.

## 6. Payload typique de `new_message_for_admin`
```json
{
  "conversationId": 42,
  "assignedAdminId": 7,
  "client": { "...": "..." },
  "girl": { "...": "..." },
  "lastMessages": [
    {
      "id": 133,
      "sender_type": "girl",
      "body": "...",
      "sender_id": 7,
      "sender_admin_id": 7,
      "assigned_admin_identifiant": "alice01"
    }
  ],
  "createdAt": 1696434000000,
  "updatedAt": 1696434001234,
  "isUpdate": false
}
```

Points clefs pour le front :
- `assignedAdminId` indique l'admin cible pour traiter le message.
- `lastMessages[].sender_admin_id` precise quel admin a ecrit chaque message de type `girl`.
- `isUpdate = true` signifie que la conversation etait deja dans la file de cet admin (nouveau message du client pendant qu'elle etaient en cours).
- `followUp = true` signale une relance automatique (ex : client de retour apres 24 h). Le front peut l'afficher comme une notification distincte si besoin.

## 7. Checklist integration front
1. Emmettre `register_admin(adminId)` au chargement de l'espace admin.
2. Ecouter `new_message_for_admin` et afficher les conversations en attente (penser a respecter la limite de 3 dans l'UI).
3. Emmettre `admin_response` apres reponse afin de liberer l'assignation cote serveur.
4. L'appel REST de reponse ne change pas; l'incrementation de points est geree automatiquement.
5. Utiliser `sender_admin_id` pour afficher l'identite de l'admin qui a ecrit chaque message de girl.
6. Sur `/admin/login`, intercepter un statut `423` (session deja active ailleurs) pour afficher un message explicite et maintenir la premiere session ouverte.

## 8. Deploiement
1. Executer la migration `20251004104500-create-conversation-admin-stat.js`.
2. Aucun bootstrap supplementaire n'est necessaire : les statistiques sont renseignees au fil de l'eau.
3. Les constantes (limite, timeout) se trouvent dans `src/sockets/messages-dispatcher.js` si besoin de les ajuster.

## 9. Tests sugeres
- Connecter deux admins, provoquer 10 messages clients et verifier que l'admin le plus actif reste prioritaire.
- Laisser un admin se deconnecter : la conversation doit etre reassignee automatiquement.
- Laisser volontairement expirer les 10 minutes pour confirmer la reassignment aleatoire.
- Controler la base : `ConversationAdminStats` doit se remplir, et les messages de type `girl` doivent contenir `sender_id = admin_id`.

## 10. Points d'extension
- Logique runtime : `src/sockets/messages-dispatcher.js`
- Persistance / stats : `src/services/conversationAssignment.service.js`
- Table d'analyse : `ConversationAdminStats`
