import { useState, useEffect } from 'react';

import { generateBlueprintZip } from './utils/exportEngine';
import ExportModal from './components/ExportModal';
import Sidebar from './components/Sidebar';
import GridCanvas from './components/GridCanvas'; // NEW!

export default function App() {
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);

  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [clipboard, setClipboard] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null);

  const [showExportCard, setShowExportCard] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setNodes(currentNodes => {
        return currentNodes.map(node => {
          if (node.type === 'SWITCH' || node.type === 'BUTTON') return node;

          const incomingWires = connections.filter(c => c.toId === node.id);
          const activeInputs = incomingWires.filter(w => {
            const fromNode = currentNodes.find(n => n.id === w.fromId);
            return fromNode && fromNode.active;
          }).length;
          const totalInputs = incomingWires.length;

          let newState = false;
          let newHistory = node.history || [];

          if (node.type === 'TIMER') {
            const inputActive = activeInputs > 0;
            const ticks = node.ticks !== undefined ? node.ticks : 40;
            newHistory = [inputActive, ...newHistory].slice(0, ticks + 1);
            newState = newHistory.length > ticks ? newHistory[ticks] : false;
          }
          else if (totalInputs > 0) {
            if (node.type === 'AND') newState = activeInputs === totalInputs;
            if (node.type === 'OR') newState = activeInputs > 0;
            if (node.type === 'XOR') newState = activeInputs % 2 === 1;
            if (node.type === 'NAND') newState = activeInputs !== totalInputs;
            if (node.type === 'NOR') newState = activeInputs === 0;
            if (node.type === 'XNOR') newState = activeInputs % 2 === 0;
          }

          return { ...node, active: newState, history: newHistory };
        });
      });
    }, 25);

    return () => clearInterval(interval);
  }, [isSimulating, connections]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !isSpacePressed) setIsSpacePressed(true);
      if (e.code === 'Escape' && showExportCard) setShowExportCard(false);
      if (e.code === 'Escape' && editingNodeId) setEditingNodeId(null);
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };
    const handleClick = () => setContextMenu(null);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('click', handleClick);
    };
  }, [isSpacePressed, showExportCard, editingNodeId]);

  const handleDelete = () => {
    setNodes(nodes.filter((n) => !selectedIds.includes(n.id)));
    setConnections(connections.filter((c) => !selectedIds.includes(c.fromId) && !selectedIds.includes(c.toId)));
    setSelectedIds([]);
  };

  const handleCopy = () => {
    const copiedNodes = nodes.filter((n) => selectedIds.includes(n.id));
    setClipboard(copiedNodes);
  };

  const handlePaste = () => {
    if (clipboard.length === 0) return;
    const newNodes = clipboard.map((n) => ({
      ...n,
      id: Date.now() + Math.random(),
      x: n.x + 1,
      y: n.y + 1,
    }));
    setNodes([...nodes, ...newNodes]);
    setSelectedIds(newNodes.map((n) => n.id));
  };

  const triggerExport = () => {
    if (nodes.length === 0) {
      alert("Place some components first!");
      return;
    }
    setShowExportCard(true);
  };

  const handleToggleSimulation = () => {
    if (!isSimulating) {
      setNodes(nodes.map(n => ({ ...n, active: false, history: [] })));
    } else {
      setNodes(nodes.map(n => {
        const { active, history, ...rest } = n;
        return rest;
      }));
    }
    setIsSimulating(!isSimulating);
    setSelectedIds([]);
    setEditingNodeId(null);
  };

  const handleExport = async (name, desc) => {
    await generateBlueprintZip(nodes, connections, name, desc);
    setShowExportCard(false);
  };

  return (
    <div className="flex h-screen w-screen bg-gray-900 text-white font-sans overflow-hidden">

      <Sidebar
        isSimulating={isSimulating}
        onToggleSimulation={handleToggleSimulation}
        onExport={triggerExport}
      />

      {/* NEW: Extracted Canvas Component */}
      <GridCanvas
        nodes={nodes} setNodes={setNodes}
        connections={connections} setConnections={setConnections}
        isSimulating={isSimulating}
        isSpacePressed={isSpacePressed}
        selectedIds={selectedIds} setSelectedIds={setSelectedIds}
        editingNodeId={editingNodeId} setEditingNodeId={setEditingNodeId}
        setContextMenu={setContextMenu}
      />

      {contextMenu && (
        <div className="fixed bg-gray-800 border border-gray-600 rounded shadow-2xl py-1 z-50 min-w-[120px]" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <button onClick={handleCopy} className="w-full text-left px-4 py-2 hover:bg-blue-600 transition-colors text-sm">Copy</button>
          <button onClick={handlePaste} disabled={clipboard.length === 0} className="w-full text-left px-4 py-2 hover:bg-blue-600 transition-colors text-sm disabled:opacity-50">Paste</button>
          <div className="h-px bg-gray-600 my-1 mx-2"></div>
          <button onClick={handleDelete} className="w-full text-left px-4 py-2 hover:bg-red-600 transition-colors text-sm text-red-400 hover:text-white">Delete</button>
        </div>
      )}

      {showExportCard && <ExportModal onClose={() => setShowExportCard(false)} onExport={handleExport} />}

    </div>
  );
}