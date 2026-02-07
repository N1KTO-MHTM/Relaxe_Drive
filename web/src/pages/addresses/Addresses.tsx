import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useToastStore } from '../../store/toast';
import './Addresses.css';

interface SavedAddress {
    id: string;
    phone?: string | null;
    address: string;
    category?: string | null;
    type?: string | null;
    useCount: number;
    lastUsedAt: string;
    createdAt: string;
}

interface PhoneMapping {
    id: string;
    originalPhone: string;
    targetPhone: string;
    description?: string;
}

export default function Addresses() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const toast = useToastStore();
    const [activeTab, setActiveTab] = useState<'addresses' | 'phone-transfers'>('addresses');
    const [addresses, setAddresses] = useState<SavedAddress[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<SavedAddress | null>(null);
    const [filterCategory, setFilterCategory] = useState('');
    const [formData, setFormData] = useState({
        phone: '',
        pickupAddress: '',
        pickupCategory: 'other',
        dropoffAddress: '',
        dropoffCategory: 'other',
    });

    // Phone mappings state
    const [phoneMappings, setPhoneMappings] = useState<PhoneMapping[]>([]);
    const [phoneMappingsLoading, setPhoneMappingsLoading] = useState(false);
    const [phoneFormData, setPhoneFormData] = useState({ originalPhone: '', targetPhone: '', description: '' });
    const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);

    const filteredAddresses = addresses.filter(addr => {
        if (filterCategory && addr.category !== filterCategory) return false;
        return true;
    });

    function loadAddresses() {
        setLoading(true);
        setError(null);
        api
            .get<SavedAddress[]>('/addresses')
            .then((data) => setAddresses(Array.isArray(data) ? data : []))
            .catch(() => {
                setError('Failed to load addresses');
                setAddresses([]);
            })
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        loadAddresses();
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            if (editingAddress) {
                // For editing, we only update the single record that was opened (address field used)
                await api.patch(`/addresses/${editingAddress.id}`, {
                    phone: formData.phone,
                    address: formData.pickupAddress || formData.dropoffAddress,
                    category: formData.pickupCategory || formData.dropoffCategory,
                    type: formData.pickupAddress ? 'pickup' : 'dropoff'
                });
                toast.success('Address updated');
            } else {
                // For new creation, we can save both if filled
                if (formData.pickupAddress) {
                    await api.post('/addresses', {
                        phone: formData.phone,
                        address: formData.pickupAddress,
                        category: formData.pickupCategory,
                        type: 'pickup'
                    });
                }
                if (formData.dropoffAddress) {
                    await api.post('/addresses', {
                        phone: formData.phone,
                        address: formData.dropoffAddress,
                        category: formData.dropoffCategory,
                        type: 'dropoff'
                    });
                }
                toast.success('Address(es) added');
            }
            loadAddresses();
            setShowAddForm(false);
            setEditingAddress(null);
            setFormData({ phone: '', pickupAddress: '', pickupCategory: 'other', dropoffAddress: '', dropoffCategory: 'other' });
        } catch {
            toast.error('Failed to save address');
        }
    }

    async function handleDelete(id: string) {
        try {
            await api.delete(`/addresses/${id}`);
            toast.success('Address deleted');
            loadAddresses();
            setDeleteConfirm(null);
        } catch {
            toast.error('Failed to delete address');
        }
    }

    function openEditForm(addr: SavedAddress) {
        setEditingAddress(addr);
        setFormData({
            phone: addr.phone || '',
            pickupAddress: addr.type === 'pickup' || addr.type === 'both' ? addr.address : '',
            pickupCategory: addr.type === 'pickup' || addr.type === 'both' ? (addr.category || 'other') : 'other',
            dropoffAddress: addr.type === 'dropoff' ? addr.address : '',
            dropoffCategory: addr.type === 'dropoff' ? (addr.category || 'other') : 'other',
        });
        setShowAddForm(true);
    }

    function closeForm() {
        setShowAddForm(false);
        setEditingAddress(null);
        setFormData({ phone: '', pickupAddress: '', pickupCategory: 'other', dropoffAddress: '', dropoffCategory: 'other' });
    }

    // Phone mapping functions
    async function loadPhoneMappings() {
        setPhoneMappingsLoading(true);
        try {
            const data = await api.get<PhoneMapping[]>('/phone-base');
            setPhoneMappings(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load phone mappings');
        } finally {
            setPhoneMappingsLoading(false);
        }
    }

    async function handlePhoneSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            if (editingPhoneId) {
                await api.patch(`/phone-base/${editingPhoneId}`, phoneFormData);
                toast.success('Phone mapping updated');
            } else {
                await api.post('/phone-base', phoneFormData);
                toast.success('Phone mapping added');
            }
            setPhoneFormData({ originalPhone: '', targetPhone: '', description: '' });
            setEditingPhoneId(null);
            loadPhoneMappings();
        } catch (e) {
            console.error(e);
            toast.error('Failed to save phone mapping');
        }
    }

    function handlePhoneEdit(m: PhoneMapping) {
        setPhoneFormData({ originalPhone: m.originalPhone, targetPhone: m.targetPhone, description: m.description || '' });
        setEditingPhoneId(m.id);
    }

    async function handlePhoneDelete(id: string) {
        if (!window.confirm(t('Are you sure?'))) return;
        try {
            await api.delete(`/phone-base/${id}`);
            toast.success('Phone mapping deleted');
            loadPhoneMappings();
        } catch (e) {
            console.error(e);
            toast.error('Failed to delete phone mapping');
        }
    }

    function handlePhoneCancel() {
        setPhoneFormData({ originalPhone: '', targetPhone: '', description: '' });
        setEditingPhoneId(null);
    }

    useEffect(() => {
        if (activeTab === 'phone-transfers') {
            loadPhoneMappings();
        }
    }, [activeTab]);

    function getCategoryBadge(category?: string | null) {
        const cat = category || 'other';
        const colors: Record<string, string> = {
            home: 'badge-home',
            work: 'badge-work',
            frequent: 'badge-frequent',
            other: 'badge-other',
        };
        return colors[cat] || 'badge-other';
    }

    function getTypeBadge(type?: string | null) {
        const t = type || 'both';
        const colors: Record<string, string> = {
            pickup: 'badge-pickup',
            dropoff: 'badge-dropoff',
            both: 'badge-both',
        };
        return colors[t] || 'badge-both';
    }

    return (
        <div className="rd-page">
            <div className="addresses-page rd-panel">
                <div className="rd-panel-header">
                    <h1>{t('addresses.title')}</h1>

                    {/* Tab Navigation */}
                    <div className="addresses-tabs" style={{ display: 'flex', gap: '1rem', marginTop: '1rem', marginBottom: '1rem' }}>
                        <button
                            type="button"
                            className={`rd-btn ${activeTab === 'addresses' ? 'rd-btn-primary' : 'rd-btn-secondary'}`}
                            onClick={() => setActiveTab('addresses')}
                        >
                            📍 Saved Addresses
                        </button>
                        <button
                            type="button"
                            className={`rd-btn ${activeTab === 'phone-transfers' ? 'rd-btn-primary' : 'rd-btn-secondary'}`}
                            onClick={() => setActiveTab('phone-transfers')}
                        >
                            📞 Phone Transfers
                        </button>
                    </div>

                    {activeTab === 'addresses' && (
                        <div className="addresses-header-actions">
                            <select
                                className="rd-input addresses-filter-select"
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                            >
                                <option value="">All Categories</option>
                                <option value="home">🏠 Home</option>
                                <option value="work">💼 Work</option>
                                <option value="frequent">⭐ Frequent</option>
                                <option value="other">📍 Other</option>
                            </select>
                            <button
                                type="button"
                                className="rd-btn rd-btn-secondary"
                                onClick={() => loadAddresses()}
                                disabled={loading}
                            >
                                {t('common.refresh')}
                            </button>
                            <button
                                type="button"
                                className="rd-btn rd-btn-primary"
                                onClick={() => setShowAddForm(true)}
                            >
                                + {t('addresses.addNew')}
                            </button>
                        </div>
                    )}
                </div>

                {/* Addresses Tab Content */}
                {activeTab === 'addresses' && (
                    <>
                        <p className="rd-text-muted addresses-subtitle">{t('addresses.subtitle')}</p>

                        {error && <p className="rd-text-critical addresses-error">{error}</p>}
                        {loading && <p className="rd-text-muted">{t('common.loading')}</p>}
                        {!loading && !error && filteredAddresses.length === 0 && (
                            <p className="rd-text-muted">{addresses.length === 0 ? t('addresses.noAddresses') : 'No addresses match this category'}</p>
                        )}

                        {!loading && !error && filteredAddresses.length > 0 && (
                            <div className="addresses-grid">
                                {filteredAddresses.map((addr) => (
                                    <div key={addr.id} className="addresses-card rd-panel">
                                        <div className="addresses-card-header">
                                            <div className="addresses-card-phone">
                                                📞 {addr.phone || 'No phone'}
                                            </div>
                                            <div className="addresses-card-actions-top">
                                                <button
                                                    type="button"
                                                    className="rd-btn-icon"
                                                    onClick={() => openEditForm(addr)}
                                                    title="Edit"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    type="button"
                                                    className="rd-btn-icon addresses-btn-delete"
                                                    onClick={() => setDeleteConfirm(addr)}
                                                    title="Delete"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>

                                        <div className="addresses-card-body">
                                            <div className="addresses-card-address">{addr.address}</div>
                                            <div className="addresses-card-meta">
                                                <span className={`addresses-badge ${getCategoryBadge(addr.category)}`}>
                                                    {addr.category === 'home' ? '🏠 ' : addr.category === 'work' ? '💼 ' : addr.category === 'frequent' ? '⭐ ' : '📍 '}
                                                    {addr.category || 'other'}
                                                </span>
                                                <span className={`addresses-badge ${getTypeBadge(addr.type)}`}>
                                                    {addr.type === 'pickup' ? '📍 Pickup' : addr.type === 'dropoff' ? '🎯 Dropoff' : '🔄 Both'}
                                                </span>
                                                <span className="addresses-use-count">
                                                    Used {addr.useCount}×
                                                </span>
                                            </div>
                                        </div>
                                        <div className="addresses-card-footer">
                                            <button
                                                type="button"
                                                className="rd-btn rd-btn-primary rd-btn-sm addresses-btn-create-order"
                                                onClick={() => navigate('/dashboard', {
                                                    state: {
                                                        prefillAddress: addr.address,
                                                        prefillPhone: addr.phone,
                                                        prefillType: addr.type
                                                    }
                                                })}
                                            >
                                                🚀 {t('addresses.createOrder')}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add/Edit Form Modal */}
                        {showAddForm && (
                            <div className="addresses-modal">
                                <div className="addresses-modal-backdrop" onClick={closeForm} />
                                <div className="addresses-modal-content rd-panel addresses-modal-split">
                                    <div className="addresses-modal-header">
                                        <h3>{editingAddress ? t('addresses.editAddress') : t('addresses.addNew')}</h3>
                                    </div>

                                    <form onSubmit={handleSubmit}>
                                        <div className="addresses-form-group-phone-inline" style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--rd-bg-muted, rgba(255, 255, 255, 0.02))', borderRadius: 'var(--rd-radius)', border: '1px solid var(--rd-border)' }}>
                                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>{t('addresses.phone')}</label>
                                            <input
                                                type="tel"
                                                className="rd-input"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                placeholder="(555) 123-4567"
                                                style={{ width: '100%' }}
                                            />
                                        </div>
                                        <div className="addresses-split-container">
                                            {/* Pickup Section */}
                                            <div className="addresses-split-box pickup-box">
                                                <div className="box-header">
                                                    <span className="box-icon">📍</span>
                                                    <h4>{t('addresses.typePickup')}</h4>
                                                </div>
                                                <div className="addresses-form-group">
                                                    <label>{t('addresses.address')}</label>
                                                    <input
                                                        type="text"
                                                        className="rd-input"
                                                        value={formData.pickupAddress}
                                                        onChange={(e) => setFormData({ ...formData, pickupAddress: e.target.value })}
                                                        placeholder="Enter pickup address"
                                                    />
                                                </div>
                                                <div className="addresses-form-group">
                                                    <label>📞 Phone Number</label>
                                                    <input
                                                        type="tel"
                                                        className="rd-input"
                                                        value={formData.phone}
                                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                        placeholder="(555) 123-4567"
                                                    />
                                                </div>
                                                <div className="addresses-form-group">
                                                    <label>{t('addresses.category')}</label>
                                                    <select
                                                        className="rd-input"
                                                        value={formData.pickupCategory}
                                                        onChange={(e) => setFormData({ ...formData, pickupCategory: e.target.value })}
                                                    >
                                                        <option value="home">🏠 Home</option>
                                                        <option value="work">💼 Work</option>
                                                        <option value="frequent">⭐ Frequent</option>
                                                        <option value="other">📍 Other</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Dropoff Section */}
                                            <div className="addresses-split-box dropoff-box">
                                                <div className="box-header">
                                                    <span className="box-icon">🎯</span>
                                                    <h4>{t('addresses.typeDropoff')}</h4>
                                                </div>
                                                <div className="addresses-form-group">
                                                    <label>{t('addresses.address')}</label>
                                                    <input
                                                        type="text"
                                                        className="rd-input"
                                                        value={formData.dropoffAddress}
                                                        onChange={(e) => setFormData({ ...formData, dropoffAddress: e.target.value })}
                                                        placeholder="Enter dropoff address"
                                                    />
                                                </div>
                                                <div className="addresses-form-group">
                                                    <label>{t('addresses.category')}</label>
                                                    <select
                                                        className="rd-input"
                                                        value={formData.dropoffCategory}
                                                        onChange={(e) => setFormData({ ...formData, dropoffCategory: e.target.value })}
                                                    >
                                                        <option value="home">🏠 Home</option>
                                                        <option value="work">💼 Work</option>
                                                        <option value="frequent">⭐ Frequent</option>
                                                        <option value="other">📍 Other</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="addresses-form-actions">
                                            <button type="button" className="rd-btn rd-btn-secondary" onClick={closeForm}>
                                                Cancel
                                            </button>
                                            <button type="submit" className="rd-btn rd-btn-primary">
                                                {editingAddress ? 'Update' : 'Add'} Address
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* Delete Confirmation Modal */}
                        {deleteConfirm && (
                            <div className="addresses-modal">
                                <div className="addresses-modal-backdrop" onClick={() => setDeleteConfirm(null)} />
                                <div className="addresses-modal-content rd-panel">
                                    <h3>{t('addresses.deleteAddress')}</h3>
                                    <p className="rd-text-muted">{t('addresses.confirmDelete')}</p>
                                    <p className="addresses-delete-preview">
                                        <strong>{deleteConfirm.phone}</strong>
                                        <br />
                                        {deleteConfirm.address}
                                    </p>
                                    <div className="addresses-form-actions">
                                        <button
                                            type="button"
                                            className="rd-btn rd-btn-secondary"
                                            onClick={() => setDeleteConfirm(null)}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="rd-btn rd-btn-danger"
                                            onClick={() => handleDelete(deleteConfirm.id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Phone Transfers Tab Content */}
                {activeTab === 'phone-transfers' && (
                    <div className="phone-transfers-content">
                        <p className="rd-text-muted" style={{ marginBottom: '1.5rem' }}>
                            Manage phone number transfers (old → new mappings) for seamless client transitions.
                        </p>

                        {/* Add/Edit Form */}
                        <div className="rd-panel" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
                            <h2 style={{ marginBottom: '1rem' }}>
                                {editingPhoneId ? 'Edit Mapping' : 'Add New Mapping'}
                            </h2>
                            <form onSubmit={handlePhoneSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'end' }}>
                                <div>
                                    <label className="rd-label">Original Phone</label>
                                    <input
                                        type="text"
                                        required
                                        className="rd-input"
                                        value={phoneFormData.originalPhone}
                                        onChange={e => setPhoneFormData({ ...phoneFormData, originalPhone: e.target.value })}
                                        placeholder="+1..."
                                        style={{ width: '200px' }}
                                    />
                                </div>
                                <div>
                                    <label className="rd-label">Target Phone</label>
                                    <input
                                        type="text"
                                        required
                                        className="rd-input"
                                        value={phoneFormData.targetPhone}
                                        onChange={e => setPhoneFormData({ ...phoneFormData, targetPhone: e.target.value })}
                                        placeholder="+1..."
                                        style={{ width: '200px' }}
                                    />
                                </div>
                                <div>
                                    <label className="rd-label">Description</label>
                                    <input
                                        type="text"
                                        className="rd-input"
                                        value={phoneFormData.description}
                                        onChange={e => setPhoneFormData({ ...phoneFormData, description: e.target.value })}
                                        placeholder="e.g. Old number of Client X"
                                        style={{ width: '300px' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button type="submit" className="rd-btn rd-btn-primary">
                                        {editingPhoneId ? 'Update' : 'Add'}
                                    </button>
                                    {editingPhoneId && (
                                        <button type="button" onClick={handlePhoneCancel} className="rd-btn rd-btn-secondary">
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>

                        {/* Mappings Table */}
                        <div className="rd-panel">
                            <table className="rd-table">
                                <thead>
                                    <tr>
                                        <th>Original Phone</th>
                                        <th>Target Phone</th>
                                        <th>Description</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {phoneMappingsLoading ? (
                                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
                                    ) : phoneMappings.length === 0 ? (
                                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rd-text-muted)' }}>No mappings found</td></tr>
                                    ) : (
                                        phoneMappings.map((m) => (
                                            <tr key={m.id}>
                                                <td>{m.originalPhone}</td>
                                                <td>{m.targetPhone}</td>
                                                <td style={{ color: 'var(--rd-text-muted)' }}>{m.description}</td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button onClick={() => handlePhoneEdit(m)} className="rd-btn-icon" title="Edit">
                                                        ✏️
                                                    </button>
                                                    <button onClick={() => handlePhoneDelete(m.id)} className="rd-btn-icon" title="Delete" style={{ marginLeft: '0.5rem' }}>
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
