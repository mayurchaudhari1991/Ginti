import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Pulse } from '@/components/motion';
import { Txt } from '@/components/txt';
import { Button, Chip, IconButton } from '@/components/ui';
import { useLedger } from '@/lib/ledger';
import { readReceipt } from '@/lib/ollama';
import { C, F } from '@/theme/tokens';

const scanLine = css.keyframes({
  '0%': { transform: [{ translateY: 0 }] },
  '50%': { transform: [{ translateY: 360 }] },
  '100%': { transform: [{ translateY: 0 }] },
});

type Stage = 'camera' | 'reading' | 'review';

export default function Scan() {
  const { categories, accounts, addTxn } = useLedger();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [stage, setStage] = useState<Stage>('camera');
  const [photo, setPhoto] = useState<string | null>(null);
  const [aiFailed, setAiFailed] = useState(false);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const live = accounts.filter((a) => !a.archived);
  const [accountId, setAccountId] = useState<string | null>(live.find((a) => a.kind === 'cash')?.id ?? live[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const expenseCats = categories.filter((c) => c.kind === 'expense');

  async function capture() {
    if (!camera.current || !ready) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const shot = await camera.current.takePictureAsync({ quality: 0.8 });
    if (!shot) return;
    setPhoto(shot.uri);
    setStage('reading');
    try {
      // Vision models read a 1024 px receipt as well as a 4000 px one, and it uploads much faster.
      const ctx = ImageManipulator.manipulate(shot.uri).resize({ width: 1024 });
      const img = await (await ctx.renderAsync()).saveAsync({ base64: true, compress: 0.75, format: SaveFormat.JPEG });
      const r = await readReceipt(img.base64 ?? '', categories);
      setMerchant(r.merchant);
      setAmount(r.total > 0 ? String(r.total) : '');
      setDate(r.date);
      setCategoryId(expenseCats.find((c) => c.name.toLowerCase() === r.category?.toLowerCase())?.id ?? null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      setAiFailed(true);
    } finally {
      setStage('review');
    }
  }

  async function save() {
    const value = Number(amount.replace(/,/g, ''));
    if (!(value > 0) || !accountId) return;
    setSaving(true);
    try {
      const when = date && !Number.isNaN(Date.parse(date)) ? new Date(`${date}T12:00:00`) : new Date();
      await addTxn({
        kind: 'expense',
        amount: value,
        account_id: accountId,
        to_account_id: null,
        category_id: categoryId,
        note: merchant.trim() || 'Receipt',
        occurred_at: when.toISOString(),
        source: 'receipt',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  function retake() {
    setPhoto(null);
    setAiFailed(false);
    setStage('camera');
  }

  if (!permission) return <View style={{ flex: 1, backgroundColor: C.ink }} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permission}>
        <View style={styles.permIcon}>
          <Icon name="scan" size={30} color={C.volt} />
        </View>
        <Txt variant="display" style={{ textAlign: 'center' }}>
          Scan receipts
        </Txt>
        <Txt style={{ textAlign: 'center', color: C.muted, lineHeight: 20 }}>
          Point the camera at a bill and Ginti AI reads the store, total and date for you.
        </Txt>
        <Button title="Allow camera" icon="check" onPress={requestPermission} style={{ alignSelf: 'stretch' }} />
        <Button title="Not now" variant="ghost" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#050608' }}>
      {stage === 'camera' ? (
        <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} onCameraReady={() => setReady(true)} />
      ) : (
        photo && <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
      )}

      <SafeAreaView style={{ flex: 1 }} pointerEvents="box-none">
        <View style={styles.top}>
          <IconButton icon="close" label="Close scanner" onPress={() => router.back()} style={styles.glass} />
          <View style={[styles.glass, styles.status]}>
            <Txt variant="label" color={C.volt}>
              {stage === 'camera' ? 'FIT THE RECEIPT IN THE FRAME' : stage === 'reading' ? 'GINTI AI IS READING…' : 'CHECK AND SAVE'}
            </Txt>
          </View>
          {stage === 'camera' ? (
            <IconButton icon="bolt" label={torch ? 'Torch off' : 'Torch on'} color={torch ? C.volt : C.text} onPress={() => setTorch(!torch)} style={styles.glass} />
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        {stage !== 'review' && (
          <View style={styles.frame} pointerEvents="none">
            {(['tl', 'tr', 'bl', 'br'] as const).map((k) => (
              <View key={k} style={[styles.corner, CORNERS[k]]} />
            ))}
            {stage === 'reading' && (
              <Animated.View
                style={[styles.line, { animationName: scanLine, animationDuration: 2400, animationIterationCount: 'infinite', animationTimingFunction: 'ease-in-out' }]}
              />
            )}
          </View>
        )}

        {stage === 'camera' && (
          <View style={styles.shutterRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Take photo" onPress={capture} disabled={!ready} style={styles.shutterOuter}>
              <View style={[styles.shutterInner, !ready && { opacity: 0.4 }]} />
            </Pressable>
          </View>
        )}

        {stage === 'reading' && (
          <View style={styles.readingPill}>
            <Pulse>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.ion }} />
            </Pulse>
            <Txt style={{ color: C.ionTextSoft }}>Reading on your PC. This takes up to a minute.</Txt>
          </View>
        )}
      </SafeAreaView>

      {stage === 'review' && (
        <View style={styles.sheet}>
          <View style={styles.grab} />
          <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
            {aiFailed && (
              <Txt style={{ color: C.warn, fontSize: 13, lineHeight: 18 }}>
                Ginti AI could not read this one (it needs your PC on the same Wi-Fi). Fill in the details below.
              </Txt>
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput value={merchant} onChangeText={setMerchant} placeholder="Store" placeholderTextColor={C.muted} style={[styles.input, { flex: 1 }]} accessibilityLabel="Store" />
              <TextInput
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^\d.]/g, ''))}
                placeholder="₹ Total"
                placeholderTextColor={C.muted}
                keyboardType="decimal-pad"
                style={[styles.input, { width: 120, fontFamily: F.display }]}
                accessibilityLabel="Total"
              />
            </View>
            {date && <Txt variant="mono">DATED {date}</Txt>}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {expenseCats.map((c) => (
                <Chip key={c.id} label={c.name} dot={c.color} active={c.id === categoryId} onPress={() => setCategoryId(c.id)} />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {live.map((a) => (
                <Chip key={a.id} label={a.name} active={a.id === accountId} onPress={() => setAccountId(a.id)} />
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Retake" variant="ghost" icon="scan" onPress={retake} style={{ flex: 1 }} />
              <Button title="Save expense" icon="check" onPress={save} busy={saving} disabled={!(Number(amount) > 0) || !accountId} style={{ flex: 1.4 }} />
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const CORNERS = {
  tl: { left: 0, top: 0, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 16 },
  tr: { right: 0, top: 0, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 16 },
  bl: { left: 0, bottom: 0, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 16 },
  br: { right: 0, bottom: 0, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 16 },
};

const styles = StyleSheet.create({
  permission: { flex: 1, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 28 },
  permIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: C.voltBg, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 },
  glass: { backgroundColor: 'rgba(16,18,26,0.82)' },
  status: { height: 36, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center', borderWidth: 1, borderColor: C.line2 },
  frame: { alignSelf: 'center', width: '78%', height: 380, marginTop: 40 },
  corner: { position: 'absolute', width: 38, height: 38, borderColor: C.volt },
  line: { position: 'absolute', left: 10, right: 10, top: 10, height: 2, backgroundColor: C.volt, shadowColor: C.volt, shadowOpacity: 0.9, shadowRadius: 10, elevation: 8 },
  shutterRow: { position: 'absolute', bottom: 56, left: 0, right: 0, alignItems: 'center' },
  shutterOuter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: C.text, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.volt },
  readingPill: {
    position: 'absolute',
    bottom: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(20,17,51,0.92)',
    borderWidth: 1,
    borderColor: C.ionLine,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '62%',
    backgroundColor: C.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1,
    borderColor: C.line2,
    padding: 20,
    paddingBottom: 32,
  },
  grab: { width: 40, height: 4, borderRadius: 4, backgroundColor: C.line2, alignSelf: 'center', marginBottom: 14 },
  input: { height: 52, borderRadius: 14, backgroundColor: C.ink2, borderWidth: 1, borderColor: C.line2, color: C.text, fontFamily: F.body, fontSize: 16, paddingHorizontal: 14 },
});
