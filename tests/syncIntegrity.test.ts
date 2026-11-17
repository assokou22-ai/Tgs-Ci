import assert from 'node:assert/strict';
import { runSyncIntegritySelfTests } from '../utils/syncIntegrityRunner.ts';

const main = async () => {
    console.log('=== Tests d’intégrité de synchronisation RM – TGS CI Repair ===\n');
    const suite = await runSyncIntegritySelfTests();

    for (const r of suite.results) {
        const badge = r.passed ? 'PASS' : 'FAIL';
        console.log(`[${badge}] Test (${r.id}) ${r.title}`);
        console.log(`       ${r.details}`);
    }

    console.log('\nRésumé:', suite.allPassed ? 'TOUS LES TESTS ONT RÉUSSI' : 'AU MOINS UN TEST A ÉCHOUÉ');
    assert.equal(suite.allPassed, true, 'Au moins un test de synchronisation a échoué.');
};

main().catch((err) => {
    console.error('Erreur fatale dans tests/syncIntegrity.test.ts:', err);
    process.exit(1);
});
