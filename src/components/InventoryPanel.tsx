import {ArrowUp, Backpack, Gem, Shield, Sword, Trash2, X} from 'lucide-react';
import {useEffect, useState} from 'react';
import {getConfig} from '../constants';
import {compareWithEquipped, INVENTORY_CAPACITY, isGear, itemPower, SLOT_FOR} from '../inventory';
import type {ItemRarity, LootItem, PlayerStats} from '../types';

interface InventoryPanelProps {
  stats: PlayerStats;
  onEquip: (itemId: string) => void;
  onDiscard: (itemId: string) => void;
  onClose: () => void;
  /** Label of the key that toggles this panel (e.g. "I"). */
  toggleKey: string;
}

const RARITY: Record<ItemRarity, {text: string; border: string; bg: string}> = {
  legendary: {text: 'text-amber-400', border: 'border-amber-500', bg: 'bg-amber-500/15'},
  epic: {text: 'text-purple-400', border: 'border-purple-500', bg: 'bg-purple-500/15'},
  rare: {text: 'text-blue-400', border: 'border-blue-500', bg: 'bg-blue-500/15'},
  common: {text: 'text-zinc-300', border: 'border-zinc-600', bg: 'bg-zinc-800/60'},
};

function ItemIcon({item, className}: {item: LootItem; className?: string}) {
  const Icon = item.type === 'weapon' ? Sword : item.type === 'armor' ? Shield : Gem;
  return <Icon className={className} />;
}

function itemSummary(item: LootItem): string {
  const parts: string[] = [];
  if (item.damage) parts.push(`+${item.damage} Dmg`);
  if (item.defense) parts.push(`+${item.defense} Def`);
  if (item.maxHpBonus) parts.push(`+${item.maxHpBonus} HP`);
  if (item.critChance) parts.push(`${Math.round(item.critChance * 100)}% Crit`);
  if (item.lifeSteal) parts.push(`${Math.round(item.lifeSteal * 100)}% Leech`);
  if (item.moveSpeedBonus) parts.push(`+${item.moveSpeedBonus} Spd`);
  return parts.join(' · ');
}

/** Bag + equipment screen. Opening it pauses the game (see isGamePaused). */
export function InventoryPanel({stats, onEquip, onDiscard, onClose, toggleKey}: InventoryPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(stats.inventory[0]?.id ?? null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const bagItem = stats.inventory.find((i) => i.id === selectedId);
  const equippedItem = [stats.equippedWeapon, stats.equippedArmor, stats.equippedRing].find(
    (i) => i.id === selectedId,
  );
  const selected = bagItem ?? equippedItem ?? null;

  useEffect(() => setConfirmDiscard(false), [selectedId]);
  // Keep a valid selection after equip/discard changes the bag.
  useEffect(() => {
    if (selectedId && !bagItem && !equippedItem) setSelectedId(stats.inventory[0]?.id ?? null);
  }, [selectedId, bagItem, equippedItem, stats.inventory]);

  const isUpgrade = (item: LootItem) => isGear(item) && itemPower(item) > itemPower(stats[SLOT_FOR[item.type]]);
  const equip = (id: string) => onEquip(id);

  const statRows: [string, string][] = [
    ['Damage', `${(stats.equippedWeapon.damage ?? 0) + stats.baseAttack}`],
    ['Defense', `${(stats.equippedArmor.defense ?? 0) + stats.baseDefense}`],
    ['Max HP', `${stats.maxHp}`],
    ['Crit', `${Math.round(stats.critChance * 100)}%`],
    ['Life Steal', `${Math.round(stats.lifeSteal * 100)}%`],
    ['Speed', `${(getConfig('playerSpeed') + (stats.equippedRing.moveSpeedBonus ?? 0)).toFixed(1)}`],
  ];

  return (
    <div
      className="absolute inset-0 z-40 bg-black/75 backdrop-blur-sm overflow-y-auto touch-auto"
      data-testid="inventory-panel"
      onClick={onClose}>
      <div className="min-h-full flex items-center justify-center p-2 md:p-4">
        <div
          className="w-full max-w-3xl bg-zinc-950 border-2 border-amber-500/60 rounded-2xl shadow-2xl p-3 md:p-5"
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Backpack className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg md:text-2xl font-black text-amber-400 tracking-wide">INVENTORY</h2>
              <span className="text-[10px] md:text-xs text-zinc-500 ml-1">
                {stats.inventory.length}/{INVENTORY_CAPACITY} · {toggleKey} / Esc to close
              </span>
            </div>
            <button
              onClick={onClose}
              data-testid="inventory-close"
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,15rem)_1fr] gap-3">
            {/* Equipped + character stats */}
            <div className="flex flex-col gap-2">
              <div className="text-[10px] font-bold text-zinc-500 tracking-widest">EQUIPPED</div>
              {[stats.equippedWeapon, stats.equippedArmor, stats.equippedRing].map((item) => {
                const r = RARITY[item.rarity];
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    data-testid={`equipped-${item.type}`}
                    className={`text-left border rounded-lg px-2 py-1.5 flex items-center gap-2 transition-colors ${r.border} ${r.bg} ${
                      selectedId === item.id ? 'ring-2 ring-amber-400' : ''
                    }`}>
                    <ItemIcon item={item} className={`w-5 h-5 shrink-0 ${r.text}`} />
                    <div className="min-w-0">
                      <div className={`text-[11px] font-bold truncate ${r.text}`}>{item.name}</div>
                      <div className="text-[9px] text-zinc-400 truncate">{itemSummary(item)}</div>
                    </div>
                  </button>
                );
              })}
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 bg-zinc-900/70 border border-zinc-800 rounded-lg p-2 text-[10px]">
                {statRows.map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-zinc-500">{label}</span>
                    <span className="font-bold text-zinc-200">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bag grid + details */}
            <div className="flex flex-col gap-2 min-w-0">
              <div className="text-[10px] font-bold text-zinc-500 tracking-widest">BAG</div>
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({length: INVENTORY_CAPACITY}, (_, i) => {
                  const item = stats.inventory[i];
                  if (!item) {
                    return <div key={`empty_${i}`} className="aspect-square rounded-lg border border-zinc-800 bg-zinc-900/40" />;
                  }
                  const r = RARITY[item.rarity];
                  return (
                    <button
                      key={item.id}
                      title={item.name}
                      data-testid="inventory-slot"
                      onClick={() => setSelectedId(item.id)}
                      onDoubleClick={() => equip(item.id)}
                      className={`relative aspect-square rounded-lg border-2 flex items-center justify-center transition-transform hover:scale-105 ${r.border} ${r.bg} ${
                        selectedId === item.id ? 'ring-2 ring-amber-400' : ''
                      }`}>
                      <ItemIcon item={item} className={`w-5 h-5 md:w-6 md:h-6 ${r.text}`} />
                      {isUpgrade(item) && (
                        <ArrowUp className="absolute top-0.5 right-0.5 w-3 h-3 text-emerald-400" strokeWidth={3} />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-2.5 min-h-[7.5rem]" data-testid="inventory-details">
                {selected ? (
                  <>
                    <div className={`text-[10px] font-bold uppercase ${RARITY[selected.rarity].text}`}>
                      {selected.rarity} {selected.type} · Lv {selected.level}
                      {equippedItem && <span className="ml-2 text-emerald-400">EQUIPPED</span>}
                    </div>
                    <div className="text-sm font-black text-white">{selected.name}</div>
                    <div className="text-[10px] text-zinc-400 mb-1.5">{selected.description}</div>
                    {bagItem && (
                      <>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] mb-2">
                          {compareWithEquipped(stats, bagItem).map((row) => (
                            <span key={row.label} className={row.value > 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {row.format(row.value)} {row.label}
                            </span>
                          ))}
                          {compareWithEquipped(stats, bagItem).length === 0 && (
                            <span className="text-zinc-500">Same stats as equipped</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => equip(bagItem.id)}
                            data-testid="inventory-equip"
                            className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs py-2 rounded-lg">
                            EQUIP
                          </button>
                          <button
                            onClick={() => {
                              if (!confirmDiscard) return setConfirmDiscard(true);
                              onDiscard(bagItem.id);
                            }}
                            data-testid="inventory-discard"
                            className={`px-3 font-bold text-xs py-2 rounded-lg border flex items-center gap-1 ${
                              confirmDiscard
                                ? 'bg-red-600 border-red-500 text-white'
                                : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-red-500'
                            }`}>
                            <Trash2 className="w-3.5 h-3.5" />
                            {confirmDiscard ? 'CONFIRM' : 'DISCARD'}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-[11px] text-zinc-500 text-center">
                    Your bag is empty. Loot that isn't better than your gear is stored here.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
