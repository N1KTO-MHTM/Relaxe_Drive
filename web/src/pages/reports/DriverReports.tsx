import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, API_BASE_URL } from '../../api/client';
import { useAuthStore } from '../../store/auth';

interface DriverReport {
    id: string;
    month: string; // YYYY-MM
    driverId: string;
    driverName: string;
    totalRides: number;
    totalEarnings: number;
    hoursOnline: number;
    createdAt: string;
    url?: string; // Link to download CSV
}

export default function DriverReports() {
    const { t } = useTranslation();
    const user = useAuthStore((s) => s.user);
    const [reports, setReports] = useState<DriverReport[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        // TODO: Implement backend endpoint /reports/driver
        // For now, mock empty or fetch if valid
        api.get<DriverReport[]>('/reports/driver')
            .then((data) => setReports(Array.isArray(data) ? data : []))
            .catch(() => setReports([])) // Fail gracefully if endpoint doesn't exist yet
            .finally(() => setLoading(false));
    }, []);

    const handleDownload = async (report: DriverReport) => {
        if (!report.url) return;
        try {
            // Fix URL: backend returns /api/reports/... but we need to respect API_BASE_URL
            // In dev (proxy): API_BASE_URL=/api, report.url=/api/... -> strip one /api
            // In prod: API_BASE_URL=https://..., report.url=/api/... -> strip /api
            let path = report.url;
            if (path.startsWith('/api/')) path = path.substring(4); // leaves /reports/...

            // Adjust API_BASE_URL if it ends with / (it shouldn't usually but be safe)
            const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
            const url = `${base}${path}`;

            const token = localStorage.getItem('relaxdrive-access-token');
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Download failed');
            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `report-${report.month}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (err) {
            console.error(err);
            alert(t('Failed to download report'));
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">
                {t('nav.driverReports') || 'Driver Monthly Reports'}
            </h1>

            <div className="bg-white dark:bg-gray-800 rounded shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('Month')}</th>
                            {user?.role !== 'DRIVER' && (
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('Driver')}</th>
                            )}
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('Rides')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('Earnings')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('Actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {loading ? (
                            <tr><td colSpan={5} className="text-center py-4">{t('Loading...')}</td></tr>
                        ) : reports.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-4 text-gray-500">{t('No reports found')}</td></tr>
                        ) : (
                            reports.map((r) => (
                                <tr key={r.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{r.month}</td>
                                    {user?.role !== 'DRIVER' && (
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{r.driverName}</td>
                                    )}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{r.totalRides}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">${(r.totalEarnings / 100).toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleDownload(r)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">
                                            {t('Download CSV')}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
