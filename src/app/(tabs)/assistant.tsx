import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import Animated, { css } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { Icon } from '@/components/icon';
import { Pulse, Rise, Spin } from '@/components/motion';
import { Txt } from '@/components/txt';
import { tap } from '@/components/ui';
import { useLedger } from '@/lib/ledger';
import { askLedger, ping, type ChatMessage } from '@/lib/ollama';
import { setPrefs, usePrefs } from '@/lib/prefs';
import { ledgerDigest } from '@/lib/stats';
import { C, F } from '@/theme/tokens';

const SUGGESTIONS = ['Where can I save this month?', 'Compare this month with last month', 'How much cash did I spend this year?', 'Which bank account do I spend most from?'];

/** Turns the model's light markdown into display parts: **bold** runs, and "* item" bullets as "•". */
function formatReply(text: string) {
  const clean = text.replace(/^\s*[*-]\s+/gm, '• ').replace(/^#+\s*/gm, '');
  return clean.split(/\*\*(.+?)\*\*/g).map((t, i) => ({ text: t, bold: i % 2 === 1 }));
}

const bounce = css.keyframes({
  '0%': { transform: [{ translateY: 0 }], opacity: 0.35 },
  '40%': { transform: [{ translateY: -5 }], opacity: 1 },
  '80%': { transform: [{ translateY: 0 }], opacity: 0.35 },
  '100%': { transform: [{ translateY: 0 }], opacity: 0.35 },
});

export default function Assistant() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const { txns, accounts, categories } = useLedger();
  const { ollamaModel, ollamaUrl, aiEnabled } = usePrefs();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const lastQ = useRef<string | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    ping().then((r) => alive && setStatus(r.ok ? { ok: true, text: `${ollamaModel.toUpperCase()} · ${r.ms} MS · PRIVATE` } : { ok: false, text: r.reason.toUpperCase() }));
    return () => {
      alive = false;
    };
  }, [ollamaModel, ollamaUrl, aiEnabled]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || thinking) return;
    tap();
    setInput('');
    const history = messages;
    setMessages([...history, { role: 'user', content: question }]);
    setThinking(true);
    try {
      const answer = await askLedger(question, ledgerDigest(txns, accounts, categories), history);
      setMessages((m) => [...m, { role: 'assistant', content: answer }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `I couldn't reach Ollama at ${ollamaUrl}. Make sure the PC is on the same Wi-Fi and Ollama is listening on the network (see Settings).` },
      ]);
    } finally {
      setThinking(false);
    }
  }

  // A question handed over from another screen (e.g. the Home insight card).
  useEffect(() => {
    if (q && q !== lastQ.current) {
      lastQ.current = q;
      send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  if (!aiEnabled) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.ink, justifyContent: 'center', padding: 28, paddingBottom: 120, gap: 16, alignItems: 'center' }}>
        <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
          <Spin duration={14000} style={StyleSheet.absoluteFill}>
            <Svg width={120} height={120}>
              <Circle cx={60} cy={60} r={54} fill="none" stroke={C.ionLine} strokeWidth={1.5} strokeDasharray={[3, 7]} />
              <Circle cx={60} cy={6} r={4} fill={C.ion} />
            </Svg>
          </Spin>
          <Icon name="sparkle" size={40} color={C.muted} />
        </View>
        <Txt variant="display" style={{ textAlign: 'center' }}>
          Ginti AI is off
        </Txt>
        <Txt style={{ color: C.muted, textAlign: 'center', lineHeight: 21 }}>
          Expenses are still read on your phone. Turn AI on to chat about your money and scan receipts with the model on your PC.
        </Txt>
        <Pressable onPress={() => setPrefs({ aiEnabled: true })} style={[styles.send, { width: undefined, paddingHorizontal: 22, flexDirection: 'row', gap: 8 }]}>
          <Icon name="sparkle" size={18} color={C.ink} strokeWidth={2} />
          <Txt style={{ fontFamily: F.semibold, color: C.ink }}>Turn on Ginti AI</Txt>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.ink }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <View style={{ width: 44, height: 44 }}>
            <Spin duration={4000} style={StyleSheet.absoluteFill}>
              <Svg width={44} height={44}>
                <Circle cx={22} cy={22} r={20} fill="none" stroke={C.ion} strokeWidth={1.5} strokeDasharray={[30, 96]} strokeLinecap="round" />
              </Svg>
            </Spin>
            <Spin duration={6000} reverse style={StyleSheet.absoluteFill}>
              <Svg width={44} height={44}>
                <Circle cx={22} cy={22} r={15} fill="none" stroke={C.volt} strokeWidth={1.5} strokeDasharray={[14, 80]} strokeLinecap="round" />
              </Svg>
            </Spin>
            <Pulse style={styles.core} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="title" style={{ fontSize: 17 }}>
              Ginti AI
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: status == null ? C.muted : status.ok ? C.good : C.warn }} />
              <Txt variant="mono" numberOfLines={1} style={{ flex: 1 }}>
                {status?.text ?? 'CHECKING OLLAMA…'}
              </Txt>
            </View>
          </View>
          {status && !status.ok && (
            <Pressable onPress={() => router.push('/settings')} hitSlop={10}>
              <Txt style={{ fontSize: 13, color: C.ionText }}>Fix</Txt>
            </Pressable>
          )}
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.thread} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {messages.length === 0 && (
            <Rise style={{ gap: 10, marginTop: 8 }}>
              <Txt variant="display" style={{ fontSize: 22, lineHeight: 30 }}>
                Ask anything about{'\n'}your money.
              </Txt>
              <Txt variant="small" style={{ fontSize: 13, lineHeight: 19 }}>
                Answers come from your own ledger, worked out by the model on your PC. Nothing leaves your network.
              </Txt>
            </Rise>
          )}
          {messages.map((msg, i) =>
            msg.role === 'user' ? (
              <Rise key={i} style={styles.userBubble}>
                <Txt style={{ color: C.ink, fontSize: 14, lineHeight: 20 }}>{msg.content}</Txt>
              </Rise>
            ) : (
              <Rise key={i} style={styles.aiBubble}>
                <Txt style={{ color: C.ionTextSoft, fontSize: 14, lineHeight: 21 }}>
                  {formatReply(msg.content).map((part, j) =>
                    part.bold ? (
                      <Txt key={j} style={{ fontFamily: F.semibold, color: C.text, fontSize: 14, lineHeight: 21 }}>
                        {part.text}
                      </Txt>
                    ) : (
                      part.text
                    ),
                  )}
                </Txt>
              </Rise>
            ),
          )}
          {thinking && (
            <View style={[styles.aiBubble, { flexDirection: 'row', gap: 6, paddingVertical: 16 }]} accessibilityLabel="Ginti AI is thinking">
              {[0, 150, 300].map((d) => (
                <Animated.View
                  key={d}
                  style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.ionText, animationName: bounce, animationDuration: 1200, animationDelay: d, animationIterationCount: 'infinite' }}
                />
              ))}
            </View>
          )}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }} style={{ flexGrow: 0 }}>
          {SUGGESTIONS.map((s) => (
            <Pressable key={s} onPress={() => send(s)} style={styles.suggestion}>
              <Txt style={{ fontSize: 12, color: C.text2 }}>{s}</Txt>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="Ask Ginti AI"
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your money"
            placeholderTextColor={C.muted}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
            style={styles.input}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={() => send(input)} style={styles.send}>
            <Icon name="send" size={22} color={C.ink} strokeWidth={2.2} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  core: { position: 'absolute', left: 16, top: 16, width: 12, height: 12, borderRadius: 6, backgroundColor: C.ion },
  thread: { padding: 20, gap: 12, flexGrow: 1 },
  userBubble: { alignSelf: 'flex-end', maxWidth: '80%', backgroundColor: C.text, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18, borderBottomRightRadius: 6 },
  aiBubble: { alignSelf: 'flex-start', maxWidth: '88%', backgroundColor: C.ionBg, borderWidth: 1, borderColor: C.ionLine, padding: 14, borderRadius: 18, borderBottomLeftRadius: 6 },
  suggestion: { height: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: C.line2, backgroundColor: C.surface, justifyContent: 'center' },
  inputRow: { flexDirection: 'row', gap: 10, padding: 20, paddingBottom: 110 },
  input: { flex: 1, height: 54, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line2, color: C.text, fontFamily: F.body, fontSize: 15, paddingHorizontal: 16 },
  send: { width: 54, height: 54, borderRadius: 18, backgroundColor: C.ion, alignItems: 'center', justifyContent: 'center' },
});
