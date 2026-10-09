# Station meteo Bresser pour Gladys Assistant

Cette integration recupere les donnees de votre station meteo **Bresser WSC Wi-Fi 5-en-1** (ou tout autre produit base sur le meme materiel Fine Offset : Ecowitt, Froggit, Ambient Weather...) directement dans Gladys Assistant, sans passer par le cloud.

## Ce qu'elle fait

- Temperature et humidite exterieures
- Temperature et humidite interieures (console)
- Pression atmospherique
- Vitesse et rafale de vent, direction du vent
- Pluviometrie (intensite et cumul du jour)
- Niveau de batterie du capteur exterieur 5-en-1
- Un widget de tableau de bord affichant la phase de la lune actuelle et un graphique d'illumination sur 30 jours (calcul astronomique local, aucune donnee de la station n'est necessaire pour cela)

## Comment ca marche

L'integration demarre un **conteneur compagnon** ("ecowitt-receiver") qui expose un port que Gladys choisit automatiquement. C'est ce port que votre station contacte directement sur votre reseau local, en HTTP, avec le protocole Ecowitt (aucune donnee ne transite par un service cloud).

## Prerequis

- Gladys Assistant 5.1.0 ou ulterieur.
- Une station Bresser (ou compatible Fine Offset) avec l'application **WSLink** ou **WSView Plus**, et un acces au reseau local de votre instance Gladys.

## Configuration

1. Installez l'integration depuis le catalogue Gladys.
2. Ouvrez l'onglet **Configuration** : la section "Connectez votre station meteo" affiche l'adresse exacte et le port a saisir (ils dependent de votre installation, Gladys les calcule pour vous).
3. Dans l'application WSLink / WSView Plus, allez dans **Weather Services > Customized** :
   - Protocol Type : **Ecowitt**
   - Server IP / Hostname : l'adresse affichee dans Gladys
   - Port : le port affiche dans Gladys
   - Path : `/data/report`
   - Upload Interval : 60 secondes
4. Enregistrez sur la station. Dans Gladys, allez dans l'onglet **Decouverte** de l'integration et cliquez sur "Creer" pour l'appareil "Station meteo Bresser".
5. Ajoutez le widget **Phase de la lune** depuis l'editeur de tableau de bord (section "Bresser Weather Station").

## Depannage

- **Aucune donnee ne remonte** : verifiez que la station et la machine qui fait tourner Gladys sont sur le meme reseau local (ou que le port est correctement redirige si votre installation Gladys est derriere un routeur), et que l'intervalle d'envoi configure sur la station correspond bien au protocole Ecowitt (pas Wunderground).
- **La batterie semble toujours a "OK"** : le capteur 5-en-1 ne remonte un niveau bas qu'en-dessous d'un certain seuil ; ce n'est pas un pourcentage continu.
- **Le widget phase de la lune n'apparait pas** : il necessite Gladys 5.1.0 ou plus recent.

## Support

Ouvrez une issue sur le depot GitHub de l'integration, ou passez par le forum de la communaute Gladys Assistant.
