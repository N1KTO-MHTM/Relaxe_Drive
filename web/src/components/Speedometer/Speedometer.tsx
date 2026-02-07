import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Speedometer.css';

interface SpeedometerProps {
    speedMph: number | null;
    standingStartedAt: number | null;
}

export default function Speedometer({ speedMph, standingStartedAt }: SpeedometerProps) {
    useTranslation();
    const [standingTime, setStandingTime] = useState(0);

    useEffect(() => {
        if (!standingStartedAt) {
            setStandingTime(0);
            return;
        }
        const interval = setInterval(() => {
            setStandingTime(Date.now() - standingStartedAt);
        }, 1000);
        return () => clearInterval(interval);
    }, [standingStartedAt]);

    // Don't show waiting time on map
    // if (standingStartedAt) {
    //     const minutes = Math.floor(standingTime / 60000);
    //     const seconds = Math.floor((standingTime % 60000) / 1000);
    //     return (
    //         <div className="speedometer speedometer--standing">
    //             <div className="speedometer-value">{minutes}:{seconds.toString().padStart(2, '0')}</div>
    //             <div className="speedometer-label">Waiting</div>
    //         </div>
    //     );
    // }

    if (speedMph === null || speedMph < 1) return null;

    return (
        <div className="speedometer">
            <div className="speedometer-value">{Math.round(speedMph)}</div>
            <div className="speedometer-label">MPH</div>
        </div>
    );
}
