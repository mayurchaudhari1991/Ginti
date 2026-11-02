import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { confirm, notify } from '@/components/dialog';
import { CATEGORY_ICONS, Icon } from '@/components/icon';
import { Rise } from '@/components/motion';
import { Txt } from '@/components/txt';
import { Button, CategoryBadge, IconButton, Screen, Segmented, tap } from '@/components/ui';
import { inr } from '@/lib/format';
import { useLedger } from '@/lib/ledger';
import { expenses, monthRange } from '@/lib/stats';
import type { Category } from '@/lib/types';
import { C, F } from '@/theme/tokens';

const COLORS = ['#FF8A4C', '#5B8CFF', '#FF5FA2', '#4CC9FF', '#FFD23F', '#3DDC97', '#9B8CFF', '#C8FF4D', '#FF6B6B', '#2DD4BF', '#F59E0B', '#8A90A2'];

type Kind = 'expense' | 'income';
type Draft = { id?: string; name: string; color: string; icon: string; kind: Kind; budget: string };

const slideUp = css.keyframes({ from: { transform: [{ translateY: 400 }] }, to: { transform: [{ translateY: 0 }] } });

export default function Categories() {
  const { create } = useLocalSearchParams<{ create?: Kind }>();
  const { categories, txns } = useLedger();
  const [kind, setKind] = useState<Kind>(create === 'income' ? 'income' : 'expense');
  const [draft, setDraft] = useState<Draft | null>(() => (create ? blank(create) : null));

  const now = new Date();
  const monthSpend = new Map<string, number>();
  for (const t of expenses(txns, monthRange(now.getFullYear(), now.getMonth()))) if (t.category_id) monthSpend.set(t.category_id, (monthSpend.get(t.category_id) ?? 0) + t.amount);
  const counts = new Map<string, number>();
  for (const t of txns) if (t.category_id) counts.set(t.category_id, (counts.get(t.category_id) ?? 0) + 1);

  const list = categories.filter((c) => c.kind === kind);

  return (
    <Screen bottomInset={40}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <Txt variant="display" style={{ fontSize: 22, flex: 1 }}>
          Categories
        </Txt>
        <IconButton icon="plus" label="New category" color={C.ink} style={{ backgroundColor: C.volt, borderColor: C.volt }} onPress={() => setDraft(blank(kind))} />
      </View>

      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
        ]}
      />

      <View style={{ gap: 8 }}>
        {list.map((c, i) => (
          <Rise key={c.id} delay={i * 40}>
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Edit category"
              onPress={() => {
                tap();
                setDraft({ id: c.id, name: c.name, color: c.color, icon: c.icon, kind: c.kind === 'income' ? 'income' : 'expense', budget: c.monthly_budget ? String(c.monthly_budget) : '' });
              }}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
              <CategoryBadge color={c.color} icon={c.icon} />
              <View style={{ flex: 1 }}>
                <Txt variant="medium">{c.name}</Txt>
                <Txt variant="mono" style={{ marginTop: 2 }}>
                  {counts.get(c.id) ?? 0} ENTRIES
                  {kind === 'expense' ? ` · ${inr(monthSpend.get(c.id) ?? 0)} THIS MONTH` : ''}
                  {c.monthly_budget ? ` · LIMIT ${inr(c.monthly_budget)}` : ''}
                </Txt>
              </View>
              <Icon name="chevron-right" size={18} color={C.muted} />
            </Pressable>
          </Rise>
        ))}
      </View>

      <Txt variant="small" style={{ lineHeight: 18 }}>
        New categories are picked up automatically: typing an expense that mentions a category by name puts it there, and Ginti AI and auto-import use them too.
      </Txt>

      {draft && <CategoryEditor draft={draft} existing={categories.find((c) => c.id === draft.id)} count={draft.id ? (counts.get(draft.id) ?? 0) : 0} onClose={() => setDraft(null)} />}
    </Screen>
  );
}

function blank(kind: Kind): Draft {
  return { name: '', color: COLORS[Math.floor(Math.random() * 8)], icon: kind === 'income' ? 'wallet' : 'dot', kind, budget: '' };
}

function CategoryEditor({ draft: initial, existing, count, onClose }: { draft: Draft; existing?: Category; count: number; onClose: () => void }) {
  const { addCategory, updateCategory, deleteCategory } = useLedger();
  const [d, setD] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const name = d.name.trim();

  async function save() {
    setSaving(true);
    try {
      const fields = { name, color: d.color, icon: d.icon, kind: d.kind, monthly_budget: d.budget ? Number(d.budget) : null };
      if (existing) await updateCategory(existing.id, fields);
      else await addCategory(fields);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    } catch (e) {
      setSaving(false);
      notify('Could not save', e instanceof Error ? e.message : String(e));
    }
  }

  async function remove() {
    if (!existing) return;
    const ok = await confirm({
      title: `Delete ${existing.name}?`,
      message: count ? `${count} ${count === 1 ? 'entry stays' : 'entries stay'} in your ledger without a category.` : 'No entries use it.',
      confirm: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteCategory(existing.id);
      onClose();
    } catch (e) {
      notify('Could not delete', e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Modal transparent visible statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View style={[styles.sheet, { animationName: slideUp, animationDuration: 320, animationTimingFunction: 'cubic-bezier(0.2, 0.9, 0.3, 1)' }]}>
          <View style={styles.grab} />
          <ScrollView contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <CategoryBadge color={d.color} icon={d.icon} size={52} />
              <View style={{ flex: 1 }}>
                <Txt variant="label">{existing ? 'EDIT CATEGORY' : `NEW ${d.kind.toUpperCase()} CATEGORY`}</Txt>
                <TextInput
                  value={d.name}
                  onChangeText={(t) => set({ name: t })}
                  placeholder={d.kind === 'income' ? 'Freelance, Rent received…' : 'Petrol, Kids, Pets…'}
                  placeholderTextColor={C.muted}
                  autoFocus={!existing}
                  maxLength={24}
                  style={styles.nameInput}
                  accessibilityLabel="Category name"
                />
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <Txt variant="small">Colour</Txt>
              <View style={styles.wrap}>
                {COLORS.map((c) => (
                  <Pressable
                    key={c}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: d.color === c }}
                    accessibilityLabel={`Colour ${c}`}
                    onPress={() => {
                      tap();
                      set({ color: c });
                    }}
                    style={[styles.swatch, { backgroundColor: c }, d.color === c && styles.swatchOn]}
                  />
                ))}
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <Txt variant="small">Icon</Txt>
              <View style={styles.wrap}>
                {CATEGORY_ICONS.map((icon) => {
                  const on = d.icon === icon;
                  return (
                    <Pressable
                      key={icon}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`Icon ${icon}`}
                      onPress={() => {
                        tap();
                        set({ icon });
                      }}
                      style={[styles.iconCell, on && { borderColor: d.color, backgroundColor: d.color + '22' }]}>
                      <Icon name={icon} size={20} color={on ? d.color : C.text2} />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {d.kind === 'expense' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Txt style={{ flex: 1 }}>Monthly limit</Txt>
                <TextInput
                  value={d.budget}
                  onChangeText={(t) => set({ budget: t.replace(/\D/g, '') })}
                  placeholder="No limit"
                  placeholderTextColor={C.muted}
                  keyboardType="number-pad"
                  style={styles.budgetInput}
                  accessibilityLabel="Monthly limit"
                />
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {existing ? <Button title="Delete" variant="danger" icon="trash" onPress={remove} style={{ flex: 1 }} /> : <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />}
              <Button title={existing ? 'Save' : 'Add category'} icon="check" onPress={save} busy={saving} disabled={!name} style={{ flex: 1.4 }} />
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
  backdrop: { flex: 1, backgroundColor: 'rgba(4,5,8,0.78)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, borderColor: C.line2, padding: 20, paddingBottom: 36, maxHeight: '88%' },
  grab: { width: 40, height: 4, borderRadius: 4, backgroundColor: C.line2, alignSelf: 'center', marginBottom: 16 },
  nameInput: { marginTop: 4, color: C.text, fontFamily: F.display, fontSize: 22, padding: 0 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 34, height: 34, borderRadius: 17 },
  swatchOn: { borderWidth: 3, borderColor: C.surface, outlineWidth: 2, outlineColor: C.text, outlineStyle: 'solid' },
  iconCell: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, borderColor: C.line2, backgroundColor: C.ink2, alignItems: 'center', justifyContent: 'center' },
  budgetInput: { width: 130, height: 46, borderRadius: 12, backgroundColor: C.ink2, borderWidth: 1, borderColor: C.line2, color: C.text, fontFamily: F.mono, fontSize: 14, textAlign: 'right', paddingHorizontal: 12 },
});
