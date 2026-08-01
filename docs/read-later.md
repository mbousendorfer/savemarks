# Web et Read later

La source **Web** regroupe les liens sauvegardés pour **Read later**. Elle conserve une fiche enrichie et une image d’aperçu
locale. Elle ne copie pas le contenu complet de l’article : le bouton **Open**
ouvre toujours la page originale.

## Ajouter un lien

Trois méthodes utilisent la même déduplication et les mêmes tags :

1. dans l’extension, ouvrir le popup puis utiliser **Read later** ;
2. faire un clic droit sur une page ou un lien ;
3. dans la web app, ouvrir la source **Web**, puis **Add → One link**.

Sauvegarder de nouveau une URL existante actualise sa fiche, la désarchive et
la remet dans **To read**.

## Importer un fichier

Ouvrir **Add → Import** et choisir :

- un fichier `.txt` avec une URL HTTP(S) par ligne ;
- un CSV UTF-8 de 10 Mio et 25 000 lignes maximum.

Le mapping reconnaît les noms de colonnes courants et peut être corrigé avant
l’import. La colonne `url` est obligatoire. Les colonnes facultatives sont
`title`, `description`, `site_name`, `author`, `image_url`, `tags`, `status` et
`saved_at`.

- séparer les tags par une virgule ou un point-virgule ;
- utiliser `unread`, `read` ou `archived` pour le statut ;
- utiliser une date ISO 8601 pour `saved_at`.

Le modèle téléchargeable dans l’interface contient un exemple valide. Le
fichier est analysé dans le navigateur et n’est jamais conservé par le serveur.
Les lignes sont ensuite envoyées par lots de 100. Les lots déjà terminés restent
enregistrés si l’onglet est fermé. Un rapport CSV est proposé pour les erreurs.

## Stockage et enrichissement

Les métadonnées présentes dans le fichier ou l’extension sont prioritaires.
SaveMarks complète les champs manquants dans une queue PostgreSQL durable et
reprend le traitement après un redémarrage. Les images valides sont stockées
sous `web/media/pictures` dans le volume média exposé.

Les adresses privées et locales ne sont jamais explorées par le serveur. Une
page interne peut néanmoins être ajoutée par l’extension avec les métadonnées
déjà visibles dans l’onglet.
