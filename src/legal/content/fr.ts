import { DEVELOPER as D, LEGAL_UPDATED, type LegalDoc } from '../developer';

/** Documents juridiques (FR). À garder alignés sur it.ts (version de référence). */
const contact = `${D.name}, ${D.street}, ${D.city}, ${D.country.fr} · ${D.email}`;

export const fr: Record<LegalDoc, string> = {
  terms: `# Conditions d'utilisation

Dernière mise à jour : ${LEGAL_UPDATED}

## 1. Qui sommes-nous
L'app AlbA est développée et distribuée par ${contact} (« nous »). En utilisant l'app, tu acceptes ces conditions.

## 2. Ce qu'est l'app
AlbA est un coach de bien-être personnel : l'app lit les données que tu choisis de partager (Apple Health ou Health Connect, profil, journal, documents), les conserve chiffrées sur ton téléphone et te donne des conseils sur le mode de vie, le sommeil, l'activité et l'alimentation à l'aide de l'intelligence artificielle.

**AlbA n'est pas un dispositif médical et ne fournit ni diagnostics, ni traitements, ni avis médicaux.** Lis aussi l'**Avertissement juridique**.

## 3. Conditions
- Tu dois avoir au moins 16 ans.
- Tu es responsable de l'exactitude des données saisies et de la bonne utilisation de l'app.

## 4. Intelligence artificielle et services tiers
- Par défaut, l'app utilise l'IA de ton téléphone (Apple Intelligence ou Gemini Nano), qui fonctionne sur l'appareil.
- Si tu choisis un service d'IA en ligne (OpenAI, Anthropic, Google), l'app le contacte directement depuis ton téléphone avec **ta** clé d'accès. Cette relation est régie par les conditions de ce service ; les éventuels frais sont facturés par ce fournisseur sur ton compte. Nous ne sommes pas responsables de la disponibilité, des coûts ou des réponses des services tiers.
- Garde ta clé d'accès en lieu sûr : elle est enregistrée chiffrée sur ton téléphone et nous ne la recevons jamais.
- Les réponses de l'IA peuvent être incomplètes ou erronées : évalue-les toujours avec esprit critique.

## 5. Utilisation autorisée
Tu peux utiliser l'app à des fins personnelles. Il est interdit de l'utiliser pour fournir des services de santé à des tiers, de contourner ses protections, de la décompiler au-delà de ce que permet la loi ou de l'utiliser de manière illicite.

## 6. Propriété intellectuelle
L'app, son code, son design et ses contenus appartiennent à ${D.name} ou à leurs titulaires respectifs. Les marques de tiers (p. ex. Apple Health, OpenAI, Anthropic, Google, Withings) appartiennent à leurs propriétaires et ne sont citées que pour indiquer la compatibilité.

## 7. Disponibilité et modifications
Nous pouvons mettre à jour, modifier ou arrêter l'app ou certaines fonctions. Les fonctions indiquées « bientôt disponible » ne sont pas garanties.

## 8. Responsabilité
Dans les limites autorisées par le droit suisse, nous excluons toute responsabilité pour les dommages résultant de l'utilisation de l'app, des réponses de l'IA ou de services tiers, sauf en cas de dol ou de faute grave. Les droits impératifs des consommateurs sont réservés.

## 9. Modifications des conditions
Nous pouvons modifier ces conditions ; la version en vigueur est toujours disponible dans l'app. En continuant à utiliser l'app après une modification, tu acceptes les nouvelles conditions.

## 10. Droit applicable et for
Le droit suisse s'applique. For : Locarno, sous réserve des fors impératifs prévus pour les consommateurs.

## Contact
${contact}
`,

  privacy: `# Politique de confidentialité

Dernière mise à jour : ${LEGAL_UPDATED}

## Le principe
**Tes données de santé restent sur ton téléphone.** AlbA n'a pas de serveur pour les données de santé : nous ne les recevons pas, ne les voyons pas et ne les vendons pas. Pas de publicité, pas de profilage, aucun outil d'analyse ou de suivi.

## Responsable du traitement
${contact}. La loi fédérale suisse sur la protection des données (LPD) s'applique et, pour les utilisateurs dans l'UE/EEE, le RGPD.

## Quelles données l'app traite (sur le téléphone)
- **Données de santé** que tu autorises depuis Apple Health ou Health Connect (p. ex. pas, sommeil, fréquence cardiaque, poids, entraînements).
- **Journal alimentaire** : les aliments que toi ou le coach enregistrez, avec calories et nutriments estimés. Sur iPhone, si tu l'actives, l'app les enregistre aussi dans Apple Health, qui reste sur ton téléphone.
- **Profil** : nom, âge, taille, objectifs, affections, médicaments et allergies que tu saisis.
- **Journal** : humeur, énergie, symptômes et notes (écrits par toi ou notés par le coach à ta demande).
- **Documents** : rapports, analyses et photos que tu ajoutes ou partages avec l'app, avec les valeurs et le résumé que l'IA en tire.
- **Conversations** avec le coach et sa mémoire : courts résumés des conversations passées et faits durables que tu lui as racontés (visibles et supprimables dans les Réglages).

Elles sont conservées dans une base de données **chiffrée** (SQLCipher, AES-256) sur l'appareil ; la clé se trouve dans le trousseau protégé du système et ne quitte jamais le téléphone. La sauvegarde automatique dans le cloud de ces données est désactivée.

## Quand les données quittent le téléphone
Uniquement dans les cas suivants, et toujours directement de ton téléphone vers le service choisi (jamais par nous) :

1. **IA en ligne** (OpenAI, Anthropic, Google), seulement si tu l'actives : à chaque question, l'app envoie ton message, un résumé des données pertinentes (p. ex. moyennes de sommeil et de pas) et les éventuelles pièces jointes. Si le coach est proactif, ce même résumé est aussi envoyé une fois par jour pour préparer ton check-in du matin. Chaque document que tu ajoutes à ton dossier santé est aussi envoyé une fois, pour que l'IA en lise les valeurs et le résume ; chaque conversation terminée est aussi envoyée une fois pour en écrire le résumé et noter les faits durables pour la mémoire du coach ; avec l'IA du téléphone, le texte des PDF et des photos est lu sur l'appareil. Le fournisseur les traite selon sa propre politique ; ses serveurs peuvent se trouver hors de Suisse et de l'UE (p. ex. aux États-Unis). Avec OpenAI, nous demandons que les conversations ne soient pas conservées (\`store: false\`). Avec l'**IA du téléphone** (par défaut), rien ne quitte l'appareil. Dans le journal alimentaire, la phrase avec laquelle tu décris un repas ou la **photo de ton assiette** est envoyée pour estimer les calories et les nutriments : la photo n'est pas enregistrée, ni sur le téléphone ni ailleurs.
2. **Voix** : la transcription se fait sur le téléphone lorsque c'est possible ; sinon, le service vocal d'Apple ou de Google est utilisé. Dans la **conversation vocale avec OpenAI**, l'audio est transmis en temps réel à OpenAI.
3. **Partage et exportation** que tu lances (p. ex. ouvrir un document dans une autre app).

## Autorisations
Santé, micro, reconnaissance vocale, appareil photo et photos ne sont demandés qu'en cas de besoin et tu peux les révoquer à tout moment dans les réglages du téléphone.

## Conservation et suppression
Les données restent aussi longtemps que tu les gardes. Tu peux supprimer des éléments dans l'app ; la désinstallation de l'app supprime la base de données chiffrée. Les données chez les fournisseurs d'IA sont soumises à leurs règles de conservation.

## Tes droits
Tu as le droit d'accès, de rectification, d'effacement, de limitation, de portabilité et d'opposition. Comme les données sont sur ton appareil, tu peux exercer la plupart de ces droits directement dans l'app. Questions : ${D.email}. Tu peux aussi t'adresser au Préposé fédéral à la protection des données et à la transparence (PFPDT) ou à l'autorité de ton pays.

## Mineurs
L'app n'est pas destinée aux personnes de moins de 16 ans.

## Modifications
Nous mettrons à jour cette politique si la manière de traiter les données change ; la date en haut indique la dernière révision.
`,

  disclaimer: `# Avertissement juridique

Dernière mise à jour : ${LEGAL_UPDATED}

## Pas un avis médical
AlbA est une app de bien-être et d'information. **Ce n'est pas un dispositif médical** et elle ne remplace ni les médecins, ni les pharmaciens, ni les autres professionnels de santé. Elle ne pose pas de diagnostic, ne prescrit pas de traitement et ne doit pas servir à prendre des décisions thérapeutiques.

## Médicaments et traitements
Ne commence, n'arrête ni ne modifie de médicaments, compléments ou traitements sur la base des suggestions de l'app : parles-en toujours à ton médecin.

## Urgences
En cas d'urgence, appelle immédiatement le **144** (Suisse) ou le **112** (Europe), ou ton médecin. N'utilise pas l'app pour les urgences.

## Intelligence artificielle
Les suggestions sont générées par des modèles d'IA qui peuvent se tromper, être incomplets ou dépassés. Évalue-les avec esprit critique.

## Approches et régimes
Les approches non conventionnelles (p. ex. médecine traditionnelle chinoise, ayurveda, naturopathie) et les régimes (p. ex. cétogène, Healthy Keto, sans lectines, carnivore) sont proposés comme ton choix personnel et en complément. Certaines affirmations de leurs auteurs ne sont pas étayées par des preuves scientifiques. En cas de maladie, de médicaments, de grossesse ou d'allaitement, demande l'avis de ton médecin avant de changer d'alimentation ou de jeûner.

## Données
Les mesures dépendent des appareils et apps sources et peuvent contenir des erreurs ou des lacunes.

## Marques
Apple Health, Apple Intelligence, Health Connect, OpenAI, Anthropic, Google, Gemini, Withings et les autres marques citées appartiennent à leurs propriétaires respectifs. AlbA n'est ni affilié à eux ni approuvé par eux.
`,

  impressum: `# Mentions légales

**${D.name}**
${D.street}
${D.city}
${D.country.fr}

Titulaire : ${D.owner}

E-mail : ${D.email}
Téléphone : ${D.phone}
Site : ${D.website}

IDE (UID) : ${D.uid}
Registre du commerce : ${D.commercialRegister}

## Responsable du contenu
${D.owner}, adresse ci-dessus.

## Exclusion de responsabilité
Bien que l'app ait été réalisée avec soin, nous ne garantissons pas l'exactitude, l'exhaustivité ni l'actualité des contenus. Les liens vers des sites et services tiers échappent à notre contrôle.
`,
};
