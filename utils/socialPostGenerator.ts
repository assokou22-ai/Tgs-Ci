import { RepairTicket } from '../types.ts';

export interface GeneratedPostOptions {
    format: 'social' | 'website' | 'simple' | 'short';
    includeHashtags?: boolean;
    includeShopContact?: boolean;
}

/**
 * Déduit l'année ou la génération approximative du MacBook si elle n'est pas explicite
 */
export const extractMacYearOrGeneration = (ticket: RepairTicket): string => {
    const model = `${ticket.macBrand || ''} ${ticket.macModel || ''} ${ticket.modelNumber || ''}`.trim();
    
    // Recherche d'une année explicite à 4 chiffres (ex: 2017, 2020, 2023)
    const yearMatch = model.match(/\b(201[0-9]|202[0-9])\b/);
    if (yearMatch) return yearMatch[1];

    // Déduction basée sur les puces Apple Silicon ou modèle AXXXX
    if (/M3\s*(Max|Pro)?/i.test(model)) return '2023 / 2024';
    if (/M2\s*(Max|Pro)?/i.test(model)) return '2022 / 2023';
    if (/M1\s*(Max|Pro)?/i.test(model)) return '2020 / 2021';
    
    if (ticket.modelNumber) {
        const mod = ticket.modelNumber.toUpperCase();
        if (mod === 'A2337' || mod === 'A2338') return '2020 (M1)';
        if (mod === 'A2442' || mod === 'A2485') return '2021 (M1 Pro/Max)';
        if (mod === 'A2681' || mod === 'A2779' || mod === 'A2780') return '2022 / 2023';
        if (mod === 'A2918' || mod === 'A2992') return '2023 (M3)';
        if (mod === 'A1708' || mod === 'A1706') return '2016 / 2017';
        if (mod === 'A1989' || mod === 'A1990') return '2018 / 2019';
        if (mod === 'A2141' || mod === 'A2159') return '2019';
        if (mod === 'A1466') return '2013 - 2017';
        if (mod === 'A1502' || mod === 'A1398') return '2013 - 2015';
    }

    return 'Récent';
};

/**
 * Détermine le type de panne pour générer le conseil pratique le plus pertinent
 */
export const generateSmartPracticalAdvice = (ticket: RepairTicket): string => {
    const fullText = `
        ${ticket.problemDescription || ''} 
        ${ticket.technicianNotes || ''} 
        ${ticket.services?.map(s => s.name).join(' ') || ''} 
        ${ticket.customFields?.symptomSummary || ''}
    `.toLowerCase();

    // 1. Dégât liquide / oxydation
    if (fullText.includes('liquide') || fullText.includes('eau') || fullText.includes('café') || fullText.includes('oxyd') || fullText.includes('jus')) {
        return "Éloignez impérativement tout liquide (café, thé, eau) de votre espace de travail. En cas d'incident, éteignez immédiatement l'ordinateur, ne le branchez SURTOUT PAS sur secteur, n'utilisez pas de riz (cela accélère la corrosion des pistes), et apportez-le au plus vite chez un spécialiste pour désoxydation aux ultrasons.";
    }

    // 2. Écran cassé / nappe / affichage
    if (fullText.includes('ecran') || fullText.includes('écran') || fullText.includes('fissur') || fullText.includes('lignes') || fullText.includes('flex') || fullText.includes('nappe')) {
        return "Avant de refermer votre MacBook, vérifiez systématiquement qu'aucun objet (stylo, écouteur, trombone ou cache-caméra en plastique) ne repose sur le clavier. Ne saisissez jamais votre ordinateur par le coin de l'écran et utilisez une housse matelassée adaptée lors des déplacements.";
    }

    // 3. Surchauffe / ventilation / pâte thermique
    if (fullText.includes('chauffe') || fullText.includes('ventilateur') || fullText.includes('pâte therm') || fullText.includes('bruit') || fullText.includes('ralenti')) {
        return "Évitez d'utiliser votre MacBook sur un lit, une couverture ou un coussin : le tissu bloque les ouïes d'évacuation thermique et aspire la poussière. Privilégiez une surface plane et prévoyez un dépoussiérage professionnel avec renouvellement de la pâte thermique tous les 12 à 18 mois.";
    }

    // 4. Alimentation / batterie / chargeur
    if (fullText.includes('batterie') || fullText.includes('charge') || fullText.includes('court-circuit') || fullText.includes('magsafe') || fullText.includes('pmic') || fullText.includes('allume pas')) {
        return "Utilisez exclusivement des chargeurs et câbles certifiés Apple (ou de marques réputées avec régulation de tension). Évitez les chargeurs génériques sans filtre de surtension qui endommagent directement la puce de charge (PMIC/ISL) sur la carte mère. En cas d'orage ou de variations de courant, débranchez la machine.";
    }

    // 5. Clavier / touches / touchpad
    if (fullText.includes('clavier') || fullText.includes('touche') || fullText.includes('trackpad') || fullText.includes('touchpad')) {
        return "Nettoyez régulièrement votre clavier avec un chiffon microfibre légèrement humidifié (jamais de spray liquide direct). Évitez de manger au-dessus de l'ordinateur car les miettes bloquent les mécanismes papillon ou ciseau.";
    }

    // Conseil universel d'expert
    return "Effectuez des sauvegardes Time Machine régulières sur un disque dur externe ou sur iCloud, et utilisez toujours un chargeur d'origine protégé contre les micro-coupures de courant pour préserver la carte mère.";
};

/**
 * Génère le descriptif textuel complet pour les réseaux sociaux et le site web
 */
export const generateSocialAndWebPost = (
    ticket: RepairTicket,
    options: GeneratedPostOptions = { format: 'social', includeHashtags: true, includeShopContact: true }
): string => {
    const brand = ticket.macBrand || 'Apple';
    const rawModel = ticket.macModel || 'MacBook Pro';
    const yearOrGen = extractMacYearOrGeneration(ticket);
    const modelFull = `${rawModel} (${yearOrGen})${ticket.modelNumber ? ` [${ticket.modelNumber}]` : ''}`.trim();

    // Problème initial
    const problem = (ticket.problemDescription || '').trim() || "Problème d'alimentation et dysfonctionnement matériel inexpliqué.";

    // État à la réception
    let intakeState = "";
    if (!ticket.powersOn) {
        intakeState = `L'ordinateur est arrivé complètement inerte à l'atelier (ne s'allumait plus, aucune réaction au chargeur : ${ticket.powerOnStatus || 'voyant éteint'}).`;
    } else {
        intakeState = `L'appareil démarrait encore mais avec des dysfonctionnements critiques : ${ticket.powerOnStatus || 'anomalies de fonctionnement'}.`;
    }

    // Solutions globales apportées
    let solutions = "";
    if (ticket.services && ticket.services.length > 0) {
        solutions = ticket.services.map(s => `• ${s.name}`).join('\n');
    } else if (ticket.technicianNotes) {
        solutions = `• ${ticket.technicianNotes}`;
    } else {
        solutions = "• Diagnostic électronique approfondi de la carte mère\n• Réparation et remise en état des circuits d'alimentation défaillants\n• Nettoyage thermique et tests de stabilité sous charge";
    }

    // Conseil pratique
    const practicalAdvice = generateSmartPracticalAdvice(ticket);

    // 1. FORMAT RÉSEAUX SOCIAUX (Instagram, Facebook, LinkedIn, Statut WhatsApp)
    if (options.format === 'social') {
        let post = `🔥 SAUVETAGE DU JOUR CHEZ TGS-CI REPAIR ! 🔥\n\n`;
        post += `💻 APPAREIL PRIS EN CHARGE :\n`;
        post += `${brand} ${modelFull}\n\n`;

        post += `⚠️ LE PROBLÈME DU CLIENT :\n`;
        post += `"${problem}"\n\n`;

        post += `🔍 ÉTAT À LA RÉCEPTION DANS NOTRE ATELIER :\n`;
        post += `${intakeState}\n\n`;

        post += `🛠️ SOLUTIONS TECHNIQUES APPORTÉES :\n`;
        post += `${solutions}\n\n`;

        post += `✨ RÉSULTAT :\n`;
        post += `Machine entièrement réparée, circuit stabilisé et toutes les fonctions testées à 100% avant remise au client avec garantie atelier !\n\n`;

        post += `💡 LE CONSEIL DE L'EXPERT POUR ÉVITER CE PROBLÈME :\n`;
        post += `👉 ${practicalAdvice}\n\n`;

        if (options.includeShopContact !== false) {
            post += `------------------------------------\n`;
            post += `📍 TGS-CI REPAIR MANAGEMENT — Atelier Spécialisé Apple & PC\n`;
            post += `🏢 Cocody Faya, Carrefour Coq Ivoir, Abidjan\n`;
            post += `📞 WhatsApp & Appels : +225 07 57 13 35 07\n`;
            post += `🌐 Devis rapide et diagnostic transparent sur place.\n\n`;
        }

        if (options.includeHashtags !== false) {
            post += `#ReparationMacBook #AppleAbidjan #TGSCI #MacBookPro #MacBookAir #MicroSoudure #ReparationOrdinateur #Abidjan #CoteDIvoire #TechAbidjan #AppleRepair`;
        }

        return post;
    }

    // 2. FORMAT SITE WEB / BLOG / PORTFOLIO D'INTERVENTION
    if (options.format === 'website') {
        let post = `CAS CLIENT & RAPPORT D'INTERVENTION : ${brand.toUpperCase()} ${modelFull.toUpperCase()}\n`;
        post += `======================================================================\n\n`;

        post += `1. Présentation du matériel\n`;
        post += `Équipement confié : ${brand} ${modelFull}\n`;
        if (ticket.serialNumber) post += `Identification : S/N ${ticket.serialNumber}\n`;
        post += `Date de prise en charge : ${new Date(ticket.createdAt).toLocaleDateString('fr-FR')}\n\n`;

        post += `2. Symptômes & Panne constatée par le propriétaire\n`;
        post += `${problem}\n\n`;

        post += `3. Constat technique à l'admission\n`;
        post += `${intakeState}\n\n`;

        post += `4. Travaux techniques et interventions réalisées\n`;
        post += `${solutions}\n\n`;

        post += `5. Validation & Contrôle qualité avant restitution\n`;
        post += `L'ensemble des composants restaurés a fait l'objet d'un cycle de tests fonctionnels complets (alimentation, gestion thermique, affichage, connectique et périphérique). L'appareil a été restitué en parfait état de marche.\n\n`;

        post += `6. Recommandations préventives de nos techniciens\n`;
        post += `${practicalAdvice}\n\n`;

        if (options.includeShopContact !== false) {
            post += `TGS-CI — Votre atelier de référence pour l'expertise et la micro-soudure sur MacBook et PC à Abidjan.\n`;
            post += `Contactez notre équipe : +225 07 57 13 35 07 • Cocody Faya.`;
        }

        return post;
    }

    // 3. FORMAT PUR / 5 POINTS DIRECTS (Brief exact : Modèle/Année, Problème, État reçu, Solutions globales, Conseil pratique)
    if (options.format === 'simple') {
        let post = `• MODÈLE / ANNÉE :\n${brand} ${modelFull}\n\n`;
        post += `• PROBLÈME SIGNALÉ PAR LE CLIENT :\n${problem}\n\n`;
        post += `• ÉTAT DANS LEQUEL NOUS L'AVONS REÇU :\n${intakeState}\n\n`;
        post += `• SOLUTIONS (GLOBALES) APPORTÉES :\n${solutions}\n\n`;
        post += `• CONSEIL PRATIQUE POUR ÉVITER CE TYPE DE PROBLÈME À L'AVENIR :\n${practicalAdvice}`;

        if (options.includeShopContact !== false) {
            post += `\n\n------------------------------------\n📍 Atelier TGS-CI • +225 07 57 13 35 07 • Cocody Faya`;
        }

        return post;
    }

    // 4. FORMAT COURT (WhatsApp Story / Status / SMS / X)
    let post = `⚡ RÉPARATION EXPRESS CHEZ TGS-CI\n`;
    post += `💻 ${brand} ${modelFull}\n`;
    post += `❌ Panne : ${problem.slice(0, 80)}${problem.length > 80 ? '...' : ''}\n`;
    post += `🛠️ Travaux : ${solutions.split('\n')[0].replace('• ', '')}\n`;
    post += `✅ Appareil 100% fonctionnel et prêt pour son propriétaire !\n\n`;
    post += `💡 Astuce de pro : ${practicalAdvice}\n\n`;
    post += `📍 TGS-CI Cocody Faya | 📞 07 57 13 35 07`;

    return post;
};
