import React, { Fragment, useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './MenuManagement.css';
import { BobaIcon } from './BobaIcon';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const defaultIconConfig = {
  teaColor: '#E6C9A8',
  milkColor: '#FFFFFF',
  waveComplexity: 1,
  hasBoba: true,
  iceLevel: 'Regular Ice',
};

function ingredientRowsFromItem(item, inventoryItems) {
  if (Array.isArray(item.ingredient_details) && item.ingredient_details.length > 0) {
    return item.ingredient_details.map((ingredient) => ({
      ingredient_id: Number(ingredient.ingredient_id),
      name: ingredient.name,
      quantity_used: Number(ingredient.quantity_used || 1),
      unit: ingredient.unit || '',
    }));
  }

  if (!item.ingredients) return [];

  return item.ingredients
    .split(',')
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isInteger(id))
    .map((id) => {
      const inventory = inventoryItems.find((inv) => Number(inv.inventory_id) === id);
      return {
        ingredient_id: id,
        name: inventory?.name || `Ingredient #${id}`,
        quantity_used: 1,
        unit: inventory?.unit || '',
      };
    });
}

function RecipeEditor({
  rows,
  inventoryItems,
  draft,
  setDraft,
  onAdd,
  onRemove,
  onQuantityChange,
  onQuantityCommit,
  disabled = false,
  datalistId,
}) {
  const selectedIngredient = inventoryItems.find(
    (item) => item.name.toLowerCase() === draft.name.trim().toLowerCase()
  );

  return (
    <div className="recipe-editor">
      <div className="ingredient-workspace">
        <div className="ingredient-picker-card">
          <div className="ingredient-picker-title">Add Ingredient</div>
          <div className="ingredient-add-row">
            <label>
              Ingredient
              <input
                type="text"
                list={datalistId}
                placeholder="Start typing..."
                value={draft.name}
                disabled={disabled}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Quantity
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={draft.quantity}
                disabled={disabled}
                onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
              />
            </label>
            <div className="ingredient-unit-preview" aria-live="polite">
              <span>Unit</span>
              <strong>{selectedIngredient?.unit || '-'}</strong>
            </div>
            <button
              type="button"
              className="action-btn add ingredient-add-btn"
              disabled={disabled || !selectedIngredient}
              onClick={onAdd}
            >
              Add
            </button>
            <datalist id={datalistId}>
              {inventoryItems.map((ingredient) => (
                <option key={ingredient.inventory_id} value={ingredient.name} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="ingredient-table-card">
          <table className="ingredient-detail-table">
            <thead>
              <tr>
                <th>Ingredient</th>
                <th>Quantity Used</th>
                <th>Unit</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="4" className="ingredient-empty">No ingredients assigned.</td>
                </tr>
              ) : (
                rows.map((ingredient) => (
                  <tr key={ingredient.ingredient_id}>
                    <td>{ingredient.name}</td>
                    <td>
                      <input
                        className="ingredient-qty-input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={ingredient.quantity_used}
                        disabled={disabled}
                        onChange={(e) => onQuantityChange(ingredient.ingredient_id, e.target.value)}
                        onBlur={() => onQuantityCommit?.()}
                      />
                    </td>
                    <td>{ingredient.unit || '-'}</td>
                    <td>
                      <button
                        type="button"
                        className="ingredient-remove-btn"
                        disabled={disabled}
                        onClick={() => onRemove(ingredient.ingredient_id)}
                        aria-label={`Remove ${ingredient.name}`}
                        title="Remove ingredient"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RecipePreview({ rows }) {
  return (
    <table className="ingredient-detail-table ingredient-readonly-table">
      <thead>
        <tr>
          <th>Ingredient</th>
          <th>Quantity Used</th>
          <th>Unit</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan="3" className="ingredient-empty">No ingredients assigned.</td>
          </tr>
        ) : (
          rows.map((ingredient) => (
            <tr key={ingredient.ingredient_id}>
              <td>{ingredient.name}</td>
              <td>{ingredient.quantity_used}</td>
              <td>{ingredient.unit || '-'}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export default function MenuManagement() {
  const [items, setItems] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const [modal, setModal] = useState(null);
  const [workspaceTab, setWorkspaceTab] = useState('table');
  const [form, setForm] = useState({
    item_name: '',
    item_category: '',
    price: '',
    ingredients: [],
    icon_config: defaultIconConfig,
  });
  const [formDraft, setFormDraft] = useState({ name: '', quantity: '1' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const flashError = (msg) => {
    setError(msg);
    setTimeout(() => setError(''), 3000);
  };

  const flashSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const [menuRes, inventoryRes] = await Promise.all([
        axios.get(`${API}/menu/items`),
        axios.get(`${API}/inventory/items`),
      ]);
      setInventoryItems(inventoryRes.data);
      setItems(menuRes.data);
    } catch (err) {
      console.error(err);
      flashError('Failed to load menu items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const rowsForItem = (item) => ingredientRowsFromItem(item, inventoryItems);

  useEffect(() => {
    if (modal === 'edit-icon' && selectedId !== null) {
      const item = items.find((i) => i.item_id === selectedId);
      if (item) {
        setForm({
          item_name: item.item_name || '',
          item_category: item.item_category || '',
          price: item.price ? parseFloat(item.price).toFixed(2) : '',
          ingredients: rowsForItem(item),
          icon_config: item.icon_config || defaultIconConfig,
        });
        setError('');
        setSuccess('');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, items, modal]);

  const openAdd = () => {
    setForm({
      item_name: '',
      item_category: '',
      price: '',
      ingredients: [],
      icon_config: defaultIconConfig,
    });
    setFormDraft({ name: '', quantity: '1' });
    setError('');
    setSuccess('');
    setWorkspaceTab('edit');
    setModal('add');
  };

  const openEdit = () => {
    if (selectedId === null) {
      flashError('Please select an item to update');
      return;
    }
    const item = items.find((i) => i.item_id === selectedId);
    if (!item) return;
    setForm({
      item_name: item.item_name,
      item_category: item.item_category,
      price: parseFloat(item.price).toFixed(2),
      ingredients: rowsForItem(item),
      icon_config: item.icon_config || defaultIconConfig,
    });
    setFormDraft({ name: '', quantity: '1' });
    setError('');
    setSuccess('');
    setWorkspaceTab('edit');
    setModal('edit');
  };

  const openEditIcon = () => {
    if (selectedId === null) {
      flashError('Please select an item to edit its icon');
      return;
    }
    const item = items.find((i) => i.item_id === selectedId);
    if (!item) return;
    setForm({
      item_name: item.item_name,
      item_category: item.item_category,
      price: parseFloat(item.price).toFixed(2),
      ingredients: rowsForItem(item),
      icon_config: item.icon_config || defaultIconConfig,
    });
    setError('');
    setSuccess('');
    setWorkspaceTab('edit');
    setModal('edit-icon');
  };

  const formPayload = () => ({
    item_name: form.item_name.trim(),
    item_category: form.item_category.trim(),
    price: parseFloat(form.price),
    icon_config: form.icon_config,
    ingredients: form.ingredients.map((row) => ({
      ingredient_id: row.ingredient_id,
      quantity_used: Number(row.quantity_used) || 1,
    })),
  });

  const validateForm = () => {
    if (!form.item_name.trim() || !form.item_category.trim()) {
      flashError('Item name and category are required');
      return false;
    }
    if (Number.isNaN(parseFloat(form.price)) || parseFloat(form.price) < 0) {
      flashError('Price must be a valid non-negative number');
      return false;
    }
    return true;
  };

  const handleAdd = async () => {
    if (!validateForm()) return;
    try {
      await axios.post(`${API}/menu/items`, formPayload());
      setModal(null);
      setWorkspaceTab('table');
      flashSuccess('Menu item added successfully!');
      loadItems();
    } catch (err) {
      flashError(err.response?.data?.error || err.message);
    }
  };

  const handleUpdate = async () => {
    if (!validateForm()) return;
    try {
      await axios.put(`${API}/menu/items/${selectedId}`, formPayload());
      setModal(null);
      setWorkspaceTab('table');
      flashSuccess('Menu item updated successfully!');
      loadItems();
    } catch (err) {
      flashError(err.response?.data?.error || err.message);
    }
  };

  const handleDelete = async () => {
    if (selectedId === null) {
      flashError('Please select an item to archive');
      return;
    }
    if (!window.confirm('Archive this item? It will be hidden from the menu but kept in the database for order history.')) return;
    try {
      await axios.delete(`${API}/menu/items/${selectedId}`);
      setSelectedId(null);
      setModal(null);
      setWorkspaceTab('table');
      flashSuccess('Menu item archived successfully!');
      loadItems();
    } catch (err) {
      flashError(err.response?.data?.error || err.message);
    }
  };

  const addIngredientToRows = (rows, draft) => {
    const inventory = inventoryItems.find(
      (item) => item.name.toLowerCase() === draft.name.trim().toLowerCase()
    );
    if (!inventory) {
      flashError('Choose an ingredient from the dropdown list');
      return null;
    }
    if (rows.some((row) => row.ingredient_id === Number(inventory.inventory_id))) {
      flashError('That ingredient is already on this item');
      return null;
    }

    return [
      ...rows,
      {
        ingredient_id: Number(inventory.inventory_id),
        name: inventory.name,
        quantity_used: Number(draft.quantity) > 0 ? Number(draft.quantity) : 1,
        unit: inventory.unit || '',
      },
    ];
  };

  const addFormIngredient = () => {
    const nextRows = addIngredientToRows(form.ingredients, formDraft);
    if (!nextRows) return;
    setForm({ ...form, ingredients: nextRows });
    setFormDraft({ name: '', quantity: '1' });
  };

  const removeFormIngredient = (ingredientId) => {
    setForm({
      ...form,
      ingredients: form.ingredients.filter((row) => row.ingredient_id !== ingredientId),
    });
  };

  const updateFormIngredientQuantity = (ingredientId, value) => {
    setForm({
      ...form,
      ingredients: form.ingredients.map((row) =>
        row.ingredient_id === ingredientId ? { ...row, quantity_used: value } : row
      ),
    });
  };

  return (
    <div className="menu-mgmt">
      <div className="mgmt-header">
        <h1>Menu Items Management</h1>
        <Link className="action-btn back-link-btn" to="/manager-dashboard">
          Back to Dashboard
        </Link>

        {error && <div className="toast toast-error">{error}</div>}
        {success && <div className="toast toast-success">{success}</div>}
      </div>

      {modal && modal !== 'edit-icon' && (
        <div className="menu-workspace-tabs" role="tablist" aria-label="Menu item workspace">
          <button
            type="button"
            role="tab"
            aria-selected={workspaceTab === 'edit'}
            className={workspaceTab === 'edit' ? 'active' : ''}
            onClick={() => setWorkspaceTab('edit')}
          >
            {modal === 'add' ? 'Add New Item' : 'Update Item'}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={workspaceTab === 'table'}
            className={workspaceTab === 'table' ? 'active' : ''}
            onClick={() => setWorkspaceTab('table')}
          >
            Menu Table
          </button>
        </div>
      )}

      <div className={`mgmt-main-content ${modal ? 'has-edit-panel' : ''} ${modal && modal !== 'edit-icon' ? 'has-recipe-panel menu-tabbed-workspace' : ''}`}>
        <div className={`mgmt-left-panel ${modal && modal !== 'edit-icon' && workspaceTab !== 'table' ? 'is-hidden' : ''}`}>
          <div className="table-wrapper glass-card">
            <table className="mgmt-table" id="menu-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Icon</th>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Ingredients</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="table-loading">Loading...</td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="table-loading">No menu items found.</td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const rows = rowsForItem(item);
                    const isExpanded = expandedId === item.item_id;
                    return (
                      <Fragment key={item.item_id}>
                        <tr
                          className={selectedId === item.item_id ? 'selected' : ''}
                          onClick={() => setSelectedId(selectedId === item.item_id ? null : item.item_id)}
                        >
                          <td>{item.item_id}</td>
                          <td>
                            <div className="menu-icon-preview">
                              <BobaIcon
                                teaColor={item.icon_config?.teaColor}
                                milkColor={item.icon_config?.milkColor}
                                waveComplexity={item.icon_config?.waveComplexity}
                                iceLevel={item.icon_config?.iceLevel ?? defaultIconConfig.iceLevel}
                                hasBoba={item.icon_config?.hasBoba}
                              />
                            </div>
                          </td>
                          <td>{item.item_name}</td>
                          <td>
                            <span className="cat-chip">{item.item_category}</span>
                          </td>
                          <td className="price-cell">${parseFloat(item.price).toFixed(2)}</td>
                          <td>
                            <button
                              type="button"
                              className={`ingredient-toggle ${isExpanded ? 'open' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedId(isExpanded ? null : item.item_id);
                                setSelectedId(item.item_id);
                              }}
                            >
                              {isExpanded ? 'Hide' : 'View'} ingredients
                              <span>{rows.length}</span>
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="ingredient-detail-row">
                            <td colSpan="6">
                              <div className="ingredient-detail-card">
                                <div className="ingredient-detail-header">
                                  <div>
                                    <h3>{item.item_name} Ingredients</h3>
                                  </div>
                                  <span className="ingredient-saving">View only</span>
                                </div>
                                <RecipePreview rows={rows} />
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mgmt-actions">
            <button className="action-btn refresh" onClick={loadItems}>
              Refresh
            </button>
            <button className="action-btn add" onClick={openAdd}>
              + New Item
            </button>
            <button className="action-btn edit" onClick={openEdit}>
              Update
            </button>
            <button className="action-btn icon-edit-btn" onClick={openEditIcon}>
              Edit Icon
            </button>
            <button className="action-btn delete" onClick={handleDelete}>
              Archive
            </button>
          </div>
        </div>

        {modal && (
          <div className={`mgmt-right-panel glass-card menu-edit-panel ${modal !== 'edit-icon' ? 'menu-recipe-panel' : ''} ${modal !== 'edit-icon' && workspaceTab !== 'edit' ? 'is-hidden' : ''}`}>
            <div className="mgmt-form-header">
              <h2>{modal === 'add' ? 'Add New Menu Item' : (modal === 'edit-icon' ? 'Customize Cup' : 'Update Menu Item')}</h2>
              <button
                className="mgmt-close-btn"
                onClick={() => {
                  setModal(null);
                  setWorkspaceTab('table');
                }}
              >
                &times;
              </button>
            </div>
            <div className="mgmt-form-body">
              {modal === 'edit-icon' ? (
                <div className="icon-editor">
                  <div className="icon-editor-preview">
                    <BobaIcon
                      teaColor={form.icon_config?.teaColor || defaultIconConfig.teaColor}
                      milkColor={form.icon_config?.milkColor || defaultIconConfig.milkColor}
                      waveComplexity={form.icon_config?.waveComplexity ?? defaultIconConfig.waveComplexity}
                      iceLevel={form.icon_config?.iceLevel ?? defaultIconConfig.iceLevel}
                      hasBoba={form.icon_config?.hasBoba ?? defaultIconConfig.hasBoba}
                    />
                  </div>

                  <div className="icon-editor-controls">
                    <label>
                      Tea Color
                      <input
                        type="color"
                        value={form.icon_config?.teaColor || defaultIconConfig.teaColor}
                        onChange={(e) => setForm({ ...form, icon_config: { ...form.icon_config, teaColor: e.target.value } })}
                      />
                    </label>
                    <label>
                      Milk Color
                      <input
                        type="color"
                        value={form.icon_config?.milkColor || defaultIconConfig.milkColor}
                        onChange={(e) => setForm({ ...form, icon_config: { ...form.icon_config, milkColor: e.target.value } })}
                      />
                    </label>
                    <label>
                      Wave Style
                      <select
                        value={form.icon_config?.waveComplexity ?? defaultIconConfig.waveComplexity}
                        onChange={(e) => setForm({ ...form, icon_config: { ...form.icon_config, waveComplexity: parseInt(e.target.value, 10) } })}
                      >
                        <option value={0}>Flat Layer</option>
                        <option value={1}>Smooth Wave</option>
                        <option value={2}>Swirling Waves</option>
                      </select>
                    </label>
                    <label>
                      Ice Level
                      <select
                        value={form.icon_config?.iceLevel ?? defaultIconConfig.iceLevel}
                        onChange={(e) => setForm({ ...form, icon_config: { ...form.icon_config, iceLevel: e.target.value } })}
                      >
                        <option value="More Ice">More Ice</option>
                        <option value="Regular Ice">Regular Ice</option>
                        <option value="Less Ice">Less Ice</option>
                        <option value="No Ice">No Ice</option>
                      </select>
                    </label>
                    <label>
                      Boba Pearls
                      <input
                        type="checkbox"
                        checked={form.icon_config?.hasBoba ?? defaultIconConfig.hasBoba}
                        onChange={(e) => setForm({ ...form, icon_config: { ...form.icon_config, hasBoba: e.target.checked } })}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <>
                  <div className="menu-form-grid">
                    <label>
                      Item Name
                      <input
                        type="text"
                        value={form.item_name}
                        onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                      />
                    </label>

                    <label>
                      Category
                      <input
                        type="text"
                        value={form.item_category}
                        onChange={(e) => setForm({ ...form, item_category: e.target.value })}
                      />
                    </label>

                    <label>
                      Price
                      <input
                        type="number"
                        step="0.01"
                        value={form.price}
                        onChange={(e) => setForm({ ...form, price: e.target.value })}
                      />
                    </label>
                  </div>

                  <div className="form-recipe-block">
                    <h3>Recipe Ingredients</h3>
                    <RecipeEditor
                      rows={form.ingredients}
                      inventoryItems={inventoryItems}
                      draft={formDraft}
                      setDraft={setFormDraft}
                      onAdd={addFormIngredient}
                      onRemove={removeFormIngredient}
                      onQuantityChange={updateFormIngredientQuantity}
                      datalistId="menu-form-ingredients"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="mgmt-form-footer">
              <button
                className="modal-cancel"
                onClick={() => {
                  setModal(null);
                  setWorkspaceTab('table');
                }}
              >
                Cancel
              </button>
              <button
                className="modal-confirm"
                onClick={modal === 'add' ? handleAdd : handleUpdate}
              >
                {modal === 'add' ? 'Add Item' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
