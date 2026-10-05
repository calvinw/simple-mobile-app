import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GraphCanvas } from '@/components/graph-canvas';
import { AnalysisView, type AnalysisViewName } from '@/components/analysis-views';
import { calculateLca, type LcaResult } from '@/lib/lca-api';
import {
  buildMobileGraph,
  type GraphNode,
  type ProductGraphCatalog,
  type ProductGraphFile,
} from '@/lib/product-graph';

const PURPLE = '#6d4aff';
const NAVY = '#172039';
const API_BASE = (process.env.EXPO_PUBLIC_LCA_API_BASE || 'https://lca.mathplosion.com').replace(/\/$/, '');
const VIEWS = ['Graph', 'Inventory', 'Impact', 'Process', 'Contribution', 'Results'] as const;
type AppView = (typeof VIEWS)[number];

export default function HomeScreen() {
  const [files, setFiles] = useState<ProductGraphFile[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode>();
  const [activeView, setActiveView] = useState<AppView>('Graph');
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lcaResult, setLcaResult] = useState<LcaResult>();
  const [calculationId, setCalculationId] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [calculationError, setCalculationError] = useState('');

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/product-graphs`);
      if (!response.ok) throw new Error(`The catalog request failed (${response.status}).`);
      const catalog = (await response.json()) as ProductGraphCatalog;
      if (!Array.isArray(catalog.product_graphs) || !catalog.product_graphs.length) {
        throw new Error('The product graph catalog is empty.');
      }
      setFiles(catalog.product_graphs);
      setSelectedId((current) =>
        catalog.product_graphs.some((file) => file.id === current) ? current : catalog.default_id
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load product graphs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadFiles(); }, [loadFiles]);

  const selectedFile = files.find((file) => file.id === selectedId);
  const graphResult = useMemo(() => {
    if (!selectedFile) return { graph: undefined, error: '' };
    try {
      return { graph: buildMobileGraph(selectedFile.product_graph), error: '' };
    } catch (parseError) {
      return {
        graph: undefined,
        error: parseError instanceof Error ? parseError.message : 'Could not read this product graph.',
      };
    }
  }, [selectedFile]);

  useEffect(() => {
    if (!selectedFile) return;
    const controller = new AbortController();
    setCalculating(true);
    setCalculationError('');
    setLcaResult(undefined);
    setCalculationId('');
    calculateLca(selectedFile.product_graph, controller.signal)
      .then((result) => {
        setLcaResult(result);
        setCalculationId(selectedFile.id);
      })
      .catch((caught) => {
        if (caught instanceof Error && caught.name === 'AbortError') return;
        setCalculationError(caught instanceof Error ? caught.message : 'Could not calculate the LCA.');
      })
      .finally(() => { if (!controller.signal.aborted) setCalculating(false); });
    return () => controller.abort();
  }, [selectedFile]);

  const chooseFile = (file: ProductGraphFile) => {
    setSelectedId(file.id);
    setSelectedNode(undefined);
    setFileMenuOpen(false);
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.logo}><Ionicons name="git-network-outline" size={24} color="#fff" /></View>
            <View>
              <Text style={styles.brandName}>PRISM</Text>
              <Text style={styles.brandSubhead}>Life Cycle Assessment</Text>
            </View>
          </View>
          <Pressable accessibilityLabel="Open settings" onPress={() => setSettingsOpen(true)} style={styles.iconButton}>
            <Ionicons name="settings-outline" size={22} color={NAVY} />
          </Pressable>
        </View>

        <View style={styles.selectorArea}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose a product graph"
            accessibilityState={{ expanded: fileMenuOpen, disabled: loading }}
            disabled={loading}
            onPress={() => setFileMenuOpen(true)}
            style={({ pressed }) => [styles.selector, pressed && styles.pressed]}>
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={PURPLE} />
                <Text style={styles.selectorText}>Loading product graphs…</Text>
              </View>
            ) : (
              <>
                <View style={styles.selectorCopy}>
                  <Text numberOfLines={1} style={styles.selectorText}>{graphResult.graph?.name ?? selectedFile?.name ?? 'Choose a graph'}</Text>
                  {selectedFile ? <Text numberOfLines={1} style={styles.filename}>{selectedFile.filename}</Text> : null}
                </View>
                <Ionicons name="chevron-down" size={20} color={NAVY} />
              </>
            )}
          </Pressable>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.viewSwitcher}>
            {VIEWS.map((view) => {
              const active = activeView === view;
              return (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  key={view}
                  onPress={() => setActiveView(view)}
                  style={[styles.viewTab, active && styles.viewTabActive]}>
                  <Text style={[styles.viewTabText, active && styles.viewTabTextActive]}>{view}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {calculating ? <View style={styles.calculationStatus}><ActivityIndicator size="small" color={PURPLE} /><Text style={styles.calculationStatusText}>Calculating inventory and impacts…</Text></View> : null}
        </View>

        <View style={styles.content}>
          {error || graphResult.error ? (
            <View style={styles.messageCard}>
              <Ionicons name="alert-circle-outline" size={27} color="#dc2626" />
              <Text style={styles.messageTitle}>Couldn’t open the graph</Text>
              <Text style={styles.messageBody}>{error || graphResult.error}</Text>
              {error ? <Pressable onPress={() => void loadFiles()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Retry</Text></Pressable> : null}
            </View>
          ) : activeView === 'Graph' && graphResult.graph ? (
            <GraphCanvas graph={graphResult.graph} selectedId={selectedNode?.id} onSelect={setSelectedNode} />
          ) : activeView !== 'Graph' && lcaResult && calculationId === selectedId ? (
            <AnalysisView view={activeView as AnalysisViewName} result={lcaResult} />
          ) : activeView !== 'Graph' && calculationError ? (
            <View style={styles.messageCard}>
              <Ionicons name="alert-circle-outline" size={27} color="#dc2626" />
              <Text style={styles.messageTitle}>Calculation failed</Text>
              <Text style={styles.messageBody}>{calculationError}</Text>
              <Pressable onPress={() => { setSelectedId(''); requestAnimationFrame(() => setSelectedId(selectedFile?.id ?? '')); }} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Retry calculation</Text></Pressable>
            </View>
          ) : activeView !== 'Graph' ? (
            <View style={styles.center}><ActivityIndicator color={PURPLE} size="large" /><Text style={styles.calculatingText}>Calculating {activeView.toLowerCase()} results…</Text></View>
          ) : (
            <View style={styles.center}><ActivityIndicator color={PURPLE} size="large" /></View>
          )}
        </View>
      </SafeAreaView>

      <PickerSheet visible={fileMenuOpen} title="Choose a product graph" onClose={() => setFileMenuOpen(false)}>
        <FlatList
          data={files}
          keyExtractor={(file) => file.id}
          renderItem={({ item }) => {
            const selected = item.id === selectedId;
            return (
              <Pressable onPress={() => chooseFile(item)} style={[styles.fileItem, selected && styles.fileItemSelected]}>
                <View style={styles.fileItemIcon}><Ionicons name="git-network-outline" size={20} color={PURPLE} /></View>
                <View style={styles.fileItemCopy}>
                  <Text numberOfLines={1} style={styles.fileItemName}>{item.name}</Text>
                  <Text numberOfLines={1} style={styles.filename}>{item.filename}</Text>
                </View>
                {selected ? <Ionicons name="checkmark-circle" size={22} color={PURPLE} /> : null}
              </Pressable>
            );
          }}
        />
      </PickerSheet>

      <PickerSheet visible={Boolean(selectedNode)} title="Process details" onClose={() => setSelectedNode(undefined)}>
        {selectedNode ? <NodeDetails node={selectedNode} /> : null}
      </PickerSheet>

      <PickerSheet visible={settingsOpen} title="Settings" onClose={() => setSettingsOpen(false)}>
        <View style={styles.settingsBody}>
          <Text style={styles.messageTitle}>Graph settings</Text>
          <Text style={styles.messageBody}>The first version uses a vertical structure layout optimized for phone screens.</Text>
          <View style={styles.settingRow}><Text style={styles.detailLabel}>Layout</Text><Text style={styles.detailValue}>Vertical</Text></View>
          <View style={styles.settingRow}><Text style={styles.detailLabel}>Mode</Text><Text style={styles.detailValue}>Read only</Text></View>
        </View>
      </PickerSheet>
    </View>
  );
}

function PickerSheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable accessibilityViewIsModal onPress={(event) => event.stopPropagation()} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable accessibilityLabel={`Close ${title}`} onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={23} color={NAVY} />
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NodeDetails({ node }: { node: GraphNode }) {
  return (
    <ScrollView contentContainerStyle={styles.details}>
      <View style={styles.nodeHeading}>
        <View style={styles.detailIcon}><Ionicons name="git-network-outline" size={23} color={PURPLE} /></View>
        <View style={styles.fileItemCopy}><Text style={styles.nodeTitle}>{node.name}</Text><Text style={styles.filename}>{node.output}</Text></View>
        <View style={styles.badge}><Text style={styles.badgeText}>{node.kind}</Text></View>
      </View>
      <DetailRow label="Output" value={node.output} />
      <DetailRow label="Amount" value={node.amount === undefined ? '—' : `${node.amount} ${node.unit ?? ''}`.trim()} />
      {node.database ? <DetailRow label="Database" value={node.database} /> : null}
      {node.location ? <DetailRow label="Location" value={node.location} /> : null}
      <DetailRow label="Inputs" value={`${node.inputs.length}`} />
      <DetailRow label="Emissions" value={`${node.emissions.length}`} />
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  safeArea: { flex: 1 },
  header: { minHeight: 72, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  logo: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: PURPLE },
  brandName: { color: NAVY, fontSize: 21, lineHeight: 24, fontWeight: '800', letterSpacing: 0.3 },
  brandSubhead: { color: '#7b849a', fontSize: 10, lineHeight: 13 },
  iconButton: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#d8ddea', alignItems: 'center', justifyContent: 'center' },
  selectorArea: { paddingHorizontal: 14, paddingBottom: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: '#e4e8f0' },
  selector: { minHeight: 58, paddingHorizontal: 15, borderRadius: 14, borderWidth: 1, borderColor: '#d4d9e5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff' },
  selectorCopy: { flex: 1, paddingRight: 10 },
  selectorText: { color: NAVY, fontSize: 16, lineHeight: 21, fontWeight: '700' },
  filename: { color: '#778096', fontSize: 11, lineHeight: 15 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  viewSwitcher: { minWidth: '100%', borderWidth: 1, borderColor: '#d4d9e5', borderRadius: 12, overflow: 'hidden' },
  viewTab: { minWidth: 92, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  viewTabActive: { margin: 3, height: 38, borderRadius: 9, backgroundColor: PURPLE },
  viewTabText: { color: NAVY, fontSize: 13, fontWeight: '700' },
  viewTabTextActive: { color: '#fff' },
  pressed: { opacity: 0.7 },
  content: { flex: 1, backgroundColor: '#f1f7fd' },
  calculationStatus: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  calculationStatusText: { color: '#687188', fontSize: 11, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  calculatingText: { color: '#687188', fontSize: 13, fontWeight: '600' },
  messageCard: { margin: 24, padding: 24, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#dde4ee' },
  placeholderIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#eeeaff', alignItems: 'center', justifyContent: 'center' },
  messageTitle: { color: NAVY, fontSize: 18, lineHeight: 23, fontWeight: '800' },
  messageBody: { color: '#687188', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  link: { color: PURPLE, fontWeight: '700', marginTop: 4 },
  primaryButton: { marginTop: 4, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 11, backgroundColor: PURPLE },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(14, 22, 42, 0.42)' },
  sheet: { maxHeight: '76%', paddingBottom: 28, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#fff' },
  handle: { width: 46, height: 5, marginTop: 9, marginBottom: 4, borderRadius: 3, alignSelf: 'center', backgroundColor: '#c7cad1' },
  sheetHeader: { minHeight: 58, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e8eaf0' },
  sheetTitle: { color: NAVY, fontSize: 17, fontWeight: '800' },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  fileItem: { minHeight: 70, marginHorizontal: 12, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  fileItemSelected: { backgroundColor: '#eeeaff' },
  fileItemIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#eeeaff', alignItems: 'center', justifyContent: 'center' },
  fileItemCopy: { flex: 1 },
  fileItemName: { color: NAVY, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  details: { paddingHorizontal: 20, paddingBottom: 12 },
  nodeHeading: { paddingVertical: 18, flexDirection: 'row', alignItems: 'center', gap: 11 },
  detailIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#eeeaff', alignItems: 'center', justifyContent: 'center' },
  nodeTitle: { color: NAVY, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  badge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9, borderWidth: 1, borderColor: '#b9aaff', backgroundColor: '#f6f3ff' },
  badgeText: { color: PURPLE, fontSize: 11, fontWeight: '700' },
  detailRow: { minHeight: 54, borderTopWidth: 1, borderTopColor: '#e8eaf0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  detailLabel: { color: '#737d94', fontSize: 13, fontWeight: '600' },
  detailValue: { flexShrink: 1, color: NAVY, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  settingsBody: { padding: 22, gap: 14 },
  settingRow: { minHeight: 50, borderTopWidth: 1, borderTopColor: '#e8eaf0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
