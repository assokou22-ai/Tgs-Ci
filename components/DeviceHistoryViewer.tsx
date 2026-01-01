import React from 'react';
import useDeviceHistory from '../hooks/useDeviceHistory.ts';

const DeviceHistoryViewer: React.FC = () => {
    const { sessions, loading } = useDeviceHistory();

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold text-white mb-2">Historique de Connexion de l'Appareil</h2>
            <p className="text-sm text-gray-400 mb-4">
                Cette section liste les démarrages de l'application sur **cet appareil uniquement**. Pour des raisons techniques et de sécurité, l'historique des autres appareils n'est pas visible ici.
            </p>

            {loading ? (
                <p className="text-gray-400">Chargement de l'historique...</p>
            ) : sessions.length > 0 ? (
                <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm text-left text-gray-300">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-700/50 sticky top-0">
                            <tr>
                                <th className="px-4 py-2">Date et Heure de Connexion</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.map(session => (
                                <tr key={session.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                    <td className="px-4 py-2 font-medium text-white">
                                        {new Date(session.timestamp).toLocaleString('fr-FR')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-gray-500">Aucun historique de session trouvé pour cet appareil.</p>
            )}
             <div className="mt-4 text-xs text-gray-500 p-3 bg-gray-900/50 rounded-md">
                <p><strong className="text-gray-400">Note sur l'adresse IP et MAC :</strong></p>
                <ul className="list-disc list-inside ml-4">
                    <li>L'<strong>adresse IP</strong> est une information visible uniquement par le serveur distant. Elle ne peut pas être récupérée de manière fiable par l'application elle-même.</li>
                    <li>L'<strong>adresse MAC</strong> est un identifiant matériel inaccessible aux applications web pour des raisons de sécurité et de protection de la vie privée.</li>
                </ul>
            </div>
             <div className="mt-4 text-xs text-gray-500 p-3 bg-gray-900/50 rounded-md">
                <p><strong className="text-gray-400">Schéma de l'Architecture de Synchronisation :</strong></p>
                <pre className="mt-2 text-gray-400 bg-black/30 p-2 rounded-md font-mono text-center text-[10px] md:text-xs overflow-x-auto">
                    [Ordinateur A] &lt;--&gt; (WebSocket) &lt;--&gt; [Serveur Node.js + Socket.IO + PostgreSQL] &lt;--&gt; (WebSocket) &lt;--&gt; [Ordinateur B]
                </pre>
            </div>
        </div>
    );
};

export default DeviceHistoryViewer;