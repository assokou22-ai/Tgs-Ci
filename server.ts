
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Lazy Gemini API Client helper
  let aiClient: GoogleGenAI | null = null;
  function getAI(): GoogleGenAI {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured on the server");
      }
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return aiClient;
  }

  // API Route for automatic detection of back cover (couvre arrière) and extraction of Serial, Model AXXXX, and EMC
  app.post("/api/gemini/extract-device-info", async (req, res) => {
    const { imageBase64, imagesBase64 } = req.body;
    const images: string[] = Array.isArray(imagesBase64) && imagesBase64.length > 0 
      ? imagesBase64 
      : (imageBase64 ? [imageBase64] : []);

    if (images.length === 0) {
      return res.status(400).json({ error: "Au moins une image (imageBase64 ou imagesBase64) est requise" });
    }

    try {
      const ai = getAI();

      // Format parts for Gemini
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      images.forEach((img, idx) => {
        let mimeType = 'image/jpeg';
        let data = img;
        if (img.includes(';base64,')) {
          const split = img.split(';base64,');
          mimeType = split[0].replace('data:', '') || 'image/jpeg';
          data = split[1];
        }
        parts.push({ text: `=== PHOTO INDEX [${idx}] ===` });
        parts.push({ inlineData: { mimeType, data } });
      });

      const promptText = `Tu es un expert Apple Mac certifié. Tu analyses ${images.length} photo(s) d'un ordinateur Apple MacBook prises dans un ordre quelconque (face avant fermée, face ouverte avec écran/clavier, vues latérales, ou le COUVRE ARRIÈRE / coque inférieure / bottom case).
Sur les MacBooks, le couvre arrière (bottom cover) comporte obligatoirement les gravures laser réglementaires officielles Apple :
- Le Numéro de Modèle (ex: "Model A2141", "Model A1707", "Model A2338", "Model A2442", "Model A2485", "Model A1989", "Model A1502", "Model A1466", "Model A1398", etc.)
- Le Numéro de Série (ex: "Serial C02XXXXXXXXX" ou "Serial: W80XXXXXXXX")
- Le Code EMC (ex: "EMC 3347", "EMC 3578", "EMC 3651", "EMC 3193", "EMC 2978", etc.)

TA MISSION PRIORITAIRE :
1. Peu importe l'ordre dans lequel les photos sont transmises, identifie AUTOMATIQUEMENT la photo qui correspond au COUVRE ARRIÈRE (capot inférieur avec gravures officielles Apple).
2. Si trouvée, extrais fidèlement :
- isBackCoverDetected: booléen (true si une des photos est le couvre arrière / capot inférieur avec gravures ou mentions Apple, sinon false).
- backCoverIndex: entier représentant l'index (0 à ${images.length - 1}) de la photo identifiée comme couvre arrière (-1 si non identifié).
- modelNumber: Numéro de modèle Apple commençant obligatoirement par 'A' suivi de 4 chiffres (ex: "A2141", "A2485"). Si absent, renvoie "".
- serialNumber: Le numéro de série Apple (10 à 12 caractères alphanumériques majuscules). Si absent, renvoie "".
- emc: Le code EMC tel que gravé (ex: "EMC 3347" ou "3347"). Si absent, renvoie "".
- color: La couleur de la coque si visible ("Gris sidéral", "Argent", "Minuit", "Lumière stellaire", "Noir sidéral", "Or"). Si indéterminée, "".
- detectionSummary: Court texte résumant la détection (ex: "Couvre arrière détecté sur photo #0 : Modèle A2141, S/N C02C1234MD6R, EMC 3347").

Réponds UNIQUEMENT un objet JSON valide avec cette structure exacte :
{
  "isBackCoverDetected": true,
  "backCoverIndex": 0,
  "modelNumber": "",
  "serialNumber": "",
  "emc": "",
  "color": "",
  "detectionSummary": ""
}`;

      parts.push({ text: promptText });

      let responseText = '';
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: 'user',
              parts
            }
          ],
          config: {
            responseMimeType: "application/json"
          }
        });
        responseText = response.text || '';
      } catch (firstErr) {
        console.warn("First model attempt failed, trying gemini-3-flash-preview:", firstErr);
        const fallbackRes = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            {
              role: 'user',
              parts
            }
          ],
          config: {
            responseMimeType: "application/json"
          }
        });
        responseText = fallbackRes.text || '';
      }

      let parsed = { 
        isBackCoverDetected: false, 
        backCoverIndex: -1, 
        modelNumber: '', 
        serialNumber: '', 
        emc: '', 
        color: '',
        detectionSummary: ''
      };

      try {
        parsed = JSON.parse(responseText || '{}');
      } catch (pErr) {
        console.warn("Could not parse JSON response:", pErr, responseText);
      }

      // Compatibilité descendante si single image ou champs historiques
      const parsedRecord = parsed as Record<string, unknown>;
      if (parsed.isBackCoverDetected === undefined && parsedRecord.isBackCover !== undefined) {
        parsed.isBackCoverDetected = Boolean(parsedRecord.isBackCover);
      }
      if (parsed.backCoverIndex === undefined || parsed.backCoverIndex === null) {
        parsed.backCoverIndex = parsed.isBackCoverDetected ? 0 : -1;
      }

      res.json(parsed);
    } catch (err: unknown) {
      console.error("Gemini extract-device-info error:", err);
      const errMsg = err instanceof Error ? err.message : "Erreur extraction OCR";
      res.status(500).json({ 
        error: errMsg, 
        isBackCoverDetected: false,
        backCoverIndex: -1,
        modelNumber: '', 
        serialNumber: '', 
        emc: '' 
      });
    }
  });

  // API Route for AI Generation
  app.post("/api/gemini/generate", async (req, res) => {
    const { prompt, systemPrompt, responseMimeType = "application/json" } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: systemPrompt || `
            Génère une réponse au format JSON strict avec deux champs :
            - title: Le titre officiel du document en majuscules.
            - content: Le corps du texte, bien structuré, avec des espaces pour les signatures.
          `,
          responseMimeType: responseMimeType,
        }
      });

      res.json({ text: response.text });
    } catch (error: unknown) {
      console.error("Gemini API Error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate content";
      res.status(500).json({ error: errorMessage });
    }
  });

  // API Route for Workshop Client Communication (Style TGS-CI Réparer Mon MacBook)
  app.post("/api/gemini/generate-client-message", async (req, res) => {
    const { 
      ticketId, 
      clientName, 
      civility = 'Monsieur', 
      macModel, 
      technicalNotes, 
      componentsReplaced = [], 
      symptoms = [], 
      requestedDays = 3, 
      calculatedDate = '', 
      scenario = 'auto' // 'two_options' | 'voltages_nand' | 'session_password' | 'auto'
    } = req.body;

    try {
      const ai = getAI();
      const systemInstruction = `Tu es l'ingénieur en chef et responsable d'atelier de TGS CI - "Réparer Mon MacBook" à Cocody Faya, Abidjan.
Tu rédiges des messages WhatsApp/SMS destinés aux clients pour leur expliquer avec clarté, courtoisie absolue, bienveillance et rigueur technique l'état d'avancement de leur MacBook.

Ton style s'appuie STRICTEMENT sur les 3 modèles réels de l'atelier :

--- EXEMPLE 1 (Blocage complexe / 2 options proposées) :
Bonjour Monsieur,
Comme promis hier, voici le point sur votre MacBook Pro 16" (2019), dossier N° 26-RM-0739.
Nous avons encore consacré toute la journée d'hier à votre machine et avons relancé la procédure avec le serveur d'Apple à de nombreuses reprises. Malheureusement, notre requête échoue toujours.
Au départ, nous pensions à une indisponibilité passagère de la connexion avec le serveur de Apple. Mais comme l'échec se répète, nous pensons maintenant que la cause est plus profonde dans la communication entre la puce de sécurité T2 et les nouvelles NAND. Trouver cette cause demande un diagnostic plus poussé, que nous ne pouvons pas faire à la hâte.
Nous savons que votre MacBook est un outil de travail essentiel pour vous et que ce retard vous pénalise. Nous en sommes sincèrement désolés, car nous espérions vous le rendre dès hier.
Pour que vous puissiez choisir ce qui convient le mieux à votre situation, nous vous proposons deux options :
1 - Poursuivre la réparation de votre carte mère actuelle
Nous reprendrons les travaux à partir du lundi 12 octobre 2026. Ce délai nous permet de terminer les travaux déjà reportés, puis de consacrer à votre carte mère toute l'attention que ce diagnostic demande.
Cette option peut vous convenir si le délai n'est pas un problème pour vous. Le résultat n'est cependant pas garanti mais rien n'est impossible en électronique, le tout n'est qu'une question de temps à nos yeux.
2 - Remplacer la carte mère sous 72 heures
Un partenaire de confiance dispose d'une carte mère compatible : Core i7, 16 Go de RAM, SSD 512 Go.
Tarif : 200 000 F CFA, avec l'achat, le montage et les tests compris.
C'est la solution la plus rapide et la plus sûre pour retrouver un ordinateur fonctionnel et reprendre votre travail au plus vite.
Dès que vous aurez fait votre choix, nous organiserons les prochaines étapes.
Passez une excellente journée Monsieur

--- EXEMPLE 2 (Point technique tensions, puces NAND endommagées, alerte perte de données) :
Bonjour Monsieur,
Comment allez vous ?
Voici le point sur l'intervention en cours sur votre MacBook. Fiche N°26 / RM 737 — MacBook Pro 16" (A2141)
*Travaux effectués
Nous avons rétabli les tensions de démarrage de la carte mère. La séquence d'allumage va maintenant jusqu'à l'initialisation du stockage (NAND).
*État actuel
La carte mère démarre et termine sa séquence d'allumage. Les tensions qui manquaient sont maintenant bien fournies : 12,6 V (PPBUS), 3,3 V (S5 / S4) et 5 V (S5 / S4).
Le démarrage se bloque ensuite au moment de la lecture des puces NAND (la mémoire de stockage).
Ces puces ne peuvent pas être lues ni chargées par le système.
*Cause identifiée
Une des puces NAND a subi un dommage latent, ce qui empêche la lecture du stockage.
*Solution proposée
La réparation est possible. Il faut remplacer les puces NAND, puis réinstaller le système. Nous n'avons pas de NAND compatibles avec votre modèle en stock pour le moment, donc il faut compter un délai supplémentaire jusqu'au jeudi 1er octobre, le temps de les trouver et de les installer.
****Important : ce remplacement entraîne la perte totale des données de la machine. Les données actuelles ne pourront pas être récupérées.
Une fois le démarrage et l'affichage validés, nous ferons les tests finaux et vérifierons que la machine fonctionne de façon stable. Nous vous recontacterons ensuite pour la récupération.
Passez une excellente journée

--- EXEMPLE 3 (Update d'intervention avec mot de passe de session requis pour activation Apple) :
Bonjour Madame,
Comment allez-vous ?
Update du rapport d'intervention — Fiche N° 26 / RM-688
Suite au premier démarrage de votre MacBook (A2338 — M2), nous avons détecté un défaut de lecture des NAND et de communication avec la mémoire unifiée.
**Interventions réalisées :
• Remplacement des NAND de stockage
• Remplacement de la PMU
• Remplacement des SoC ROM
**État actuel :
Le MacBook démarre. Il doit maintenant être restauré complètement pour être activé par les serveurs Apple dans le processus en cours.
** Important — Mot de passe requis :
Apple exigera obligatoirement l'ancien mot de passe de session (bureau) pour valider l'activation de votre MacBook auprès de ses serveurs.
Sans ce mot de passe :
• La restauration ne pourra pas aboutir
• Nous ne pourrons pas effectuer les tests de confirmation de fin de travaux sur votre MacBook
Ces tests seront réalisés ligne par ligne sur votre machine (affichage, clavier, trackpad, ports USB-C, Wi-Fi, Bluetooth, caméra, son, batterie, charge, NAND, etc.) afin de vous remettre un MacBook dont chaque fonction a été validée et dont l'effectivité du fonctionnement et la stabilité sont confirmées.
**Concernant vos données :
Le remplacement des NAND entraîne malheureusement l'effacement complet des données. Toutes les anciennes puces retirées de votre carte vous seront remises lors de la restitution de votre MacBook.
**Cause du défaut :
Défaut connu sur certains modèles Apple Silicon : les puces programmables perdent leur activité après une inactivité prolongée en état OFF.
**Retrait :
Vendredi à partir de 10 h, selon votre disponibilité.
Pouvez-vous, s'il vous plaît, nous communiquer l'ancien mot de passe de session de votre ancien bureau, afin que nous puissions finaliser dès que possible l'activation et les tests ?
Passez une excellente journée, Madame.

RÈGLES D'OR :
1. Utilise la civilité correcte (Bonjour ${civility || 'Monsieur'}).
2. Précise le dossier N°${ticketId || '...'} et le modèle exact (${macModel || 'MacBook'}).
3. Sois extrêmement professionnel, poli, sans jargon incompréhensible, transparent sur les délais et la perte de données si applicable.
4. Réponds UNIQUEMENT le texte du message prêt à être envoyé par WhatsApp/SMS. Aucun texte méta ni balisage JSON.`;

      const userPrompt = `Rédige le message pour ce dossier :
- Client : ${clientName || 'Client'} (${civility})
- Modèle : ${macModel}
- Dossier N° : ${ticketId}
- Scénario / Orientation : ${scenario}
- Composants remplacés / manipulés : ${componentsReplaced.join(', ') || 'Composants d\'alimentation'}
- Symptômes / Blocages observés : ${symptoms.join(', ') || technicalNotes || 'Bancs de test sous microscope'}
- Notes techniques saisies par le technicien : "${technicalNotes || 'N/A'}"
- Rallonge estimée : ${requestedDays} jours ouvrés
- Date calculée : ${calculatedDate || 'prochainement'}

Génère un message complet, parfaitement structuré et chaleureux selon les règles de TGS CI.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction,
        }
      });

      res.json({ message: response.text });
    } catch (err: unknown) {
      console.error("Gemini generate-client-message error:", err);
      const errMsg = err instanceof Error ? err.message : "Erreur de génération de message";
      res.status(500).json({ error: errMsg });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
