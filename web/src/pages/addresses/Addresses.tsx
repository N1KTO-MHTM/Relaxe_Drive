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

export default function Addresses() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const toast = useToastStore();
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
                </div>
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
            </div>
        </div>
    );
}
