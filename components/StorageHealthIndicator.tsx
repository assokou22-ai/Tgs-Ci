
import React, { useState, useEffect } from 'react';
import { dbGetStorageEstimate } from '../services/dbService.ts';
import { HardDriveIcon } from 'lucide-react';
import { motion } from 'framer-motion';

const StorageHealthIndicator: React.FC = () => {
    const [estimate, setEstimate] = useState<{ usage: number; quota: number; percent: number } | null>(null);

    useEffect(() => {
        const check = async () => {
            const res = await dbGetStorageEstimate();
            setEstimate(res);
        };
        check();
        const interval = setInterval(check, 60000);
        return () => clearInterval(interval);
    }, []);

    if (!estimate) return null;

    const usageGo = (estimate.usage / (1024 * 1024 * 1024)).toFixed(1);
    const quotaGo = (estimate.quota / (1024 * 1024 * 1024)).toFixed(0);

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl"
            title={`Stockage : ${usageGo} Go / ${quotaGo} Go`}
        >
            <HardDriveIcon className={`w-3.5 h-3.5 ${estimate.percent > 80 ? 'text-red-500' : 'text-emerald-500'}`} />
            <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-0.5">Stockage</span>
                <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div 
                            className={`h-full ${estimate.percent > 80 ? 'bg-red-500' : 'bg-emerald-500'}`}
                            style={{ width: `${estimate.percent}%` }}
                        ></div>
                    </div>
                    <span className="text-[8px] font-bold text-white/60">{usageGo}G</span>
                </div>
            </div>
        </motion.div>
    );
};

export default StorageHealthIndicator;
