import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from '../../api/axios';

interface PhoneMapping {
    id: string;
    originalPhone: string;
    targetPhone: string;
    description?: string;
}

export default function PhoneBase() {
    const { t } = useTranslation();
    const [mappings, setMappings] = useState<PhoneMapping[]>([]);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ originalPhone: '', targetPhone: '', description: '' });
    const [editingId, setEditingId] = useState<string | null>(null);

    const fetchMappings = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/phone-base');
            setMappings(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMappings();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await axios.patch(`/phone-base/${editingId}`, formData);
            } else {
                await axios.post('/phone-base', formData);
            }
            setFormData({ originalPhone: '', targetPhone: '', description: '' });
            setEditingId(null);
            fetchMappings();
        } catch (error) {
            console.error(error);
            alert('Failed to save mapping');
        }
    };

    const handleEdit = (m: PhoneMapping) => {
        setFormData({ originalPhone: m.originalPhone, targetPhone: m.targetPhone, description: m.description || '' });
        setEditingId(m.id);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm(t('Are you sure?'))) return;
        try {
            await axios.delete(`/phone-base/${id}`);
            fetchMappings();
        } catch (error) {
            console.error(error);
        }
    };

    const handleCancel = () => {
        setFormData({ originalPhone: '', targetPhone: '', description: '' });
        setEditingId(null);
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">{t('Phone Base (Transferred Numbers)')}</h1>

            <div className="bg-white dark:bg-gray-800 p-4 rounded shadow mb-8">
                <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
                    {editingId ? t('Edit Mapping') : t('Add New Mapping')}
                </h2>
                <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('Original Phone')}</label>
                        <input
                            type="text"
                            required
                            className="border p-2 rounded w-48 dark:bg-gray-700 dark:text-white"
                            value={formData.originalPhone}
                            onChange={e => setFormData({ ...formData, originalPhone: e.target.value })}
                            placeholder="+1..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('Target Phone')}</label>
                        <input
                            type="text"
                            required
                            className="border p-2 rounded w-48 dark:bg-gray-700 dark:text-white"
                            value={formData.targetPhone}
                            onChange={e => setFormData({ ...formData, targetPhone: e.target.value })}
                            placeholder="+1..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('Description')}</label>
                        <input
                            type="text"
                            className="border p-2 rounded w-64 dark:bg-gray-700 dark:text-white"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            placeholder="e.g. Old number of Client X"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                            {editingId ? t('Update') : t('Add')}
                        </button>
                        {editingId && (
                            <button type="button" onClick={handleCancel} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                                {t('Cancel')}
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('Original Phone')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('Target Phone')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('Description')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('Actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {loading ? (
                            <tr><td colSpan={4} className="text-center py-4">{t('Loading...')}</td></tr>
                        ) : mappings.length === 0 ? (
                            <tr><td colSpan={4} className="text-center py-4 text-gray-500">{t('No mappings found')}</td></tr>
                        ) : (
                            mappings.map((m) => (
                                <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{m.originalPhone}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{m.targetPhone}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{m.description}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleEdit(m)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-4">
                                            {t('Edit')}
                                        </button>
                                        <button onClick={() => handleDelete(m.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                                            {t('Delete')}
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
