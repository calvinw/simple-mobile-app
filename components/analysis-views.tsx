import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { LcaResult, ProcessContributionCategory } from '@/lib/lca-api';

const PURPLE = '#6d4aff';
const NAVY = '#172039';

export type AnalysisViewName = 'Inventory' | 'Impact' | 'Process' | 'Contribution' | 'Results';

const number = (value: number) => {
  const absolute = Math.abs(value);
  if (absolute !== 0 && (absolute < 0.001 || absolute >= 100000)) return value.toExponential(3);
  return new Intl.NumberFormat('en-US', { maximumSignificantDigits: 5 }).format(value);
};
const categoryName = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function AnalysisView({ view, result }: { view: AnalysisViewName; result: LcaResult }) {
  if (view === 'Inventory') return <Inventory result={result} />;
  if (view === 'Impact') return <Impact result={result} />;
  if (view === 'Process') return <ProcessResults result={result} />;
  if (view === 'Contribution') return <Contribution result={result} />;
  return <Results result={result} />;
}

function Page({ result, title, subtitle, children }: { result: LcaResult; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <View><Text style={styles.eyebrow}>{result.method}</Text><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View>
      {children}
    </ScrollView>
  );
}

function Inventory({ result }: { result: LcaResult }) {
  const flows = Object.entries(result.lci).sort(([, left], [, right]) => Math.abs(right.amount) - Math.abs(left.amount));
  return <Page result={result} title="Inventory" subtitle={`${flows.length} calculated environmental flows`}>
    <Section title="Life-cycle inventory" icon="leaf-outline">
      {flows.map(([name, flow]) => <MetricRow key={name} label={name} hint={flow.type} value={number(flow.amount)} unit={flow.unit} />)}
    </Section>
  </Page>;
}

function Impact({ result }: { result: LcaResult }) {
  const impacts = Object.entries(result.lcia).sort(([, left], [, right]) => Math.abs(right.score) - Math.abs(left.score));
  const maximum = Math.max(...impacts.map(([, impact]) => Math.abs(impact.score)), 1);
  return <Page result={result} title="Impact" subtitle={`${impacts.length} LCIA impact categories`}>
    <Section title="Impact assessment" icon="bar-chart-outline">
      {impacts.map(([name, impact]) => <View key={name} style={styles.chartRow}>
        <Text style={styles.rowLabel}>{categoryName(name)}</Text>
        <Text style={styles.rowValue}>{number(impact.score)} <Text style={styles.unit}>{impact.unit}</Text></Text>
        <View style={styles.track}><View style={[styles.bar, { width: `${Math.max(2, Math.abs(impact.score) / maximum * 100)}%` }]} /></View>
      </View>)}
    </Section>
  </Page>;
}

function CategoryPicker({ categories, selected, onSelect }: { categories: ProcessContributionCategory[]; selected: string; onSelect: (id: string) => void }) {
  return <View style={styles.chips}>
    {categories.map((category) => <Pressable key={category.id || category.label} onPress={() => onSelect(category.id || category.label)} style={[styles.chip, selected === (category.id || category.label) && styles.chipActive]}>
      <Text style={[styles.chipText, selected === (category.id || category.label) && styles.chipTextActive]}>{categoryName(category.label)}</Text>
    </Pressable>)}
  </View>;
}

function useCategory(result: LcaResult) {
  const categories = result.process_contributions.categories;
  const [selected, setSelected] = useState(categories[0]?.id || categories[0]?.label || '');
  useEffect(() => { if (!categories.some((item) => (item.id || item.label) === selected)) setSelected(categories[0]?.id || categories[0]?.label || ''); }, [categories, selected]);
  return { categories, selected, setSelected, category: categories.find((item) => (item.id || item.label) === selected) ?? categories[0] };
}

function ProcessResults({ result }: { result: LcaResult }) {
  const { categories, selected, setSelected, category } = useCategory(result);
  const rows = [...(category?.processes ?? [])].sort((left, right) => Math.abs(right.direct_score) - Math.abs(left.direct_score));
  return <Page result={result} title="Process results" subtitle="Direct impacts from each foreground and background process">
    <CategoryPicker categories={categories} selected={selected} onSelect={setSelected} />
    <Section title={categoryName(category?.label ?? 'Processes')} icon="git-network-outline">
      {rows.map((process) => <ContributionRow key={process.process_id} name={process.process_name} scope={process.scope} score={process.direct_score} percentage={process.percentage} unit={category?.unit ?? ''} />)}
    </Section>
  </Page>;
}

function Contribution({ result }: { result: LcaResult }) {
  const { categories, selected, setSelected, category } = useCategory(result);
  const graph = result.contribution_graphs.find((item) => item.id === selected || item.label === category?.label);
  const rows = graph?.activity_contributions.length
    ? [...graph.activity_contributions].sort((left, right) => Math.abs(right.direct_score) - Math.abs(left.direct_score))
    : [...(category?.processes ?? [])].sort((left, right) => Math.abs(right.direct_score) - Math.abs(left.direct_score));
  return <Page result={result} title="Contribution" subtitle="Share of total impact by activity">
    <CategoryPicker categories={categories} selected={selected} onSelect={setSelected} />
    <View style={styles.totalCard}><Text style={styles.eyebrow}>TOTAL IMPACT</Text><Text style={styles.totalValue}>{number(graph?.total_score ?? category?.total_score ?? 0)}</Text><Text style={styles.totalUnit}>{graph?.unit ?? category?.unit}</Text></View>
    <Section title="Activity contributions" icon="pie-chart-outline">
      {rows.map((item) => <ContributionRow key={'activity_id' in item ? item.activity_id : item.process_id} name={item.process_name} scope={item.scope} score={item.direct_score} percentage={item.percentage} unit={graph?.unit ?? category?.unit ?? ''} />)}
    </Section>
  </Page>;
}

function Results({ result }: { result: LcaResult }) {
  return <Page result={result} title="Results" subtitle={result.functional_unit}>
    <View style={styles.summaryGrid}>
      <Summary label="Inventory flows" value={`${Object.keys(result.lci).length}`} icon="leaf-outline" />
      <Summary label="Impact categories" value={`${Object.keys(result.lcia).length}`} icon="bar-chart-outline" />
      <Summary label="Processes" value={`${Object.keys(result.scaling_vector).length}`} icon="git-network-outline" />
      <Summary label="Result ID" value={result.result_id.slice(0, 8)} icon="checkmark-circle-outline" />
    </View>
    <Section title="Impact summary" icon="analytics-outline">
      {Object.entries(result.lcia).map(([name, impact]) => <MetricRow key={name} label={categoryName(name)} value={number(impact.score)} unit={impact.unit} />)}
    </Section>
  </Page>;
}

function Section({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return <View style={styles.section}>
    <View style={styles.sectionTitle}>
      <Ionicons name={icon} size={19} color={PURPLE} />
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
    {children}
  </View>;
}
function MetricRow({ label, hint, value, unit }: { label: string; hint?: string; value: string; unit: string }) {
  return <View style={styles.metricRow}>
    <View style={styles.metricCopy}><Text style={styles.rowLabel}>{label}</Text>{hint ? <Text style={styles.hint}>{hint}</Text> : null}</View>
    <Text style={styles.rowValue}>{value} <Text style={styles.unit}>{unit}</Text></Text>
  </View>;
}
function ContributionRow({ name, scope, score, percentage, unit }: { name: string; scope: string; score: number; percentage: number | null; unit: string }) {
  const width = Math.min(100, Math.max(0, Math.abs(percentage ?? 0)));
  return <View style={styles.contributionRow}>
    <Text style={styles.rowLabel}>{name}</Text>
    <View style={styles.contributionMeta}><Text style={styles.hint}>{scope}</Text><Text style={styles.percent}>{percentage === null ? '—' : `${number(percentage)}%`}</Text></View>
    <View style={styles.track}><View style={[styles.bar, { width: `${width}%` }]} /></View>
    <Text style={styles.score}>{number(score)} {unit}</Text>
  </View>;
}
function Summary({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return <View style={styles.summaryCard}><Ionicons name={icon} size={21} color={PURPLE} /><Text numberOfLines={1} style={styles.summaryValue}>{value}</Text><Text style={styles.hint}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f1f7fd' }, pageContent: { padding: 18, paddingBottom: 38, gap: 16 },
  eyebrow: { color: PURPLE, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 }, title: { color: NAVY, fontSize: 24, lineHeight: 30, fontWeight: '800' }, subtitle: { color: '#6f7890', fontSize: 13, lineHeight: 19, marginTop: 2 },
  section: { borderRadius: 16, borderWidth: 1, borderColor: '#dfe5ef', backgroundColor: '#fff', overflow: 'hidden' }, sectionTitle: { minHeight: 50, paddingHorizontal: 15, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#e7eaf0' }, sectionTitleText: { flex: 1, color: NAVY, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  metricRow: { minHeight: 72, paddingHorizontal: 15, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e3e6ed', gap: 6 }, metricCopy: { gap: 1 }, rowLabel: { color: NAVY, fontSize: 12, lineHeight: 17, fontWeight: '700' }, hint: { color: '#7c859a', fontSize: 9, lineHeight: 13, textTransform: 'capitalize' }, rowValue: { color: NAVY, fontSize: 13, lineHeight: 18, fontWeight: '800' }, unit: { color: '#737d94', fontSize: 10, fontWeight: '500' },
  chartRow: { padding: 15, gap: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e3e6ed' }, chartHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, track: { height: 7, borderRadius: 4, backgroundColor: '#ebeef4', overflow: 'hidden' }, bar: { height: '100%', borderRadius: 4, backgroundColor: PURPLE },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { width: '48.5%', minHeight: 48, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 13, borderWidth: 1, borderColor: '#d6dbe6', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }, chipActive: { borderColor: PURPLE, backgroundColor: PURPLE }, chipText: { width: '100%', color: NAVY, fontSize: 11, lineHeight: 15, fontWeight: '700', textAlign: 'center' }, chipTextActive: { color: '#fff' },
  contributionRow: { padding: 15, gap: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e3e6ed' }, contributionMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, percent: { color: PURPLE, fontSize: 13, fontWeight: '800' }, score: { color: '#687188', fontSize: 10 },
  totalCard: { padding: 18, borderRadius: 16, backgroundColor: NAVY }, totalValue: { color: '#fff', fontSize: 29, lineHeight: 35, fontWeight: '800' }, totalUnit: { color: '#bfc7d9', fontSize: 12 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, summaryCard: { width: '48%', minHeight: 112, padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#dfe5ef', backgroundColor: '#fff', justifyContent: 'space-between' }, summaryValue: { color: NAVY, fontSize: 21, fontWeight: '800' },
});
