import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, UtensilsCrossed, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { getInviteItems, createInviteItem, deleteInviteItem } from '@/services/partyInvites';

const CATEGORIES = ['Food', 'Drinks', 'Supplies', 'Other'];

export function PotluckTab({ invite, organizer }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Food');
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadItems();
  }, [invite.id]);

  async function loadItems() {
    setLoading(true);
    try {
      const data = await getInviteItems(invite.id);
      setItems(data);
    } catch (err) {
      console.error('Error loading items:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!name.trim()) return;
    setAdding(true);
    try {
      await createInviteItem(invite.id, organizer.id, { name: name.trim(), category, quantity });
      setName('');
      setQuantity(1);
      await loadItems();
      toast.success('Item added');
    } catch (err) {
      console.error('Error adding item:', err);
      toast.error('Failed to add item');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(itemId) {
    try {
      await deleteInviteItem(itemId);
      setItems(prev => prev.filter(i => i.id !== itemId));
      toast.success('Item removed');
    } catch {
      toast.error('Failed to remove item');
    }
  }

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = items.filter(i => i.category === cat);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Add item form */}
      <div className="p-4 bg-gray-50 rounded-xl space-y-3">
        <p className="text-sm font-semibold text-gray-700">Add an item for guests to bring</p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <Label className="text-xs">Item name *</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Chips & Dip"
              className="rounded-lg mt-1"
              onKeyDown={e => { if (e.key === 'Enter' && name.trim()) handleAdd(); }}
            />
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="rounded-lg h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Qty</Label>
            <Input
              type="number"
              min={1}
              max={99}
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value) || 1)}
              className="rounded-lg mt-1"
            />
          </div>
        </div>
        <Button onClick={handleAdd} disabled={!name.trim() || adding} className="rounded-xl gap-2" size="sm">
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add Item
        </Button>
      </div>

      {/* Items list grouped by category */}
      {items.length === 0 ? (
        <div className="text-center py-12">
          <UtensilsCrossed className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">No items yet. Add items for your guests to bring!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {CATEGORIES.map(cat => {
            const catItems = grouped[cat];
            if (catItems.length === 0) return null;
            return (
              <div key={cat}>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">{cat}</h4>
                <div className="space-y-1.5">
                  {catItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        item.claimed_by_name ? 'bg-emerald-100' : 'bg-gray-200'
                      }`}>
                        {item.claimed_by_name ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <span className="text-[10px] font-bold text-gray-400">{item.quantity}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${item.claimed_by_name ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                          {item.name}
                          {item.quantity > 1 && !item.claimed_by_name && (
                            <span className="text-xs text-gray-400 ml-1">x{item.quantity}</span>
                          )}
                        </p>
                        {item.claimed_by_name && (
                          <p className="text-xs text-emerald-600">Claimed by {item.claimed_by_name}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
