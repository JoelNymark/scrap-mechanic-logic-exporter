import { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';

// NEW: Added a 'w' property to specify grid width. Timer is natively 2 blocks wide in Scrap Mechanic!
const COMPONENTS = [
  { type: 'AND', color: 'bg-blue-500', mode: 0, category: 'gate' },
  { type: 'OR', color: 'bg-green-500', mode: 1, category: 'gate' },
  { type: 'XOR', color: 'bg-purple-500', mode: 2, category: 'gate' },
  { type: 'NAND', color: 'bg-red-500', mode: 3, category: 'gate' },
  { type: 'NOR', color: 'bg-orange-500', mode: 4, category: 'gate' },
  { type: 'XNOR', color: 'bg-pink-500', mode: 5, category: 'gate' },

  { type: 'SWITCH', color: 'bg-yellow-600', category: 'interactable', shapeId: "7cf717d7-d167-4f2d-a6e7-6b2c70aa3986" },
  { type: 'BUTTON', color: 'bg-yellow-500', category: 'interactable', shapeId: "1e8d93a4-506b-470d-9ada-9c0a321e2db5" },
  { type: 'TIMER', color: 'bg-teal-500', category: 'interactable', shapeId: "8f7fd0e7-c46e-4944-a414-7ce2437bb30f", w: 2 },
];

const PALETTE = [
  { tw: 'bg-red-500', hex: 'ef4444' },
  { tw: 'bg-orange-500', hex: 'f97316' },
  { tw: 'bg-yellow-500', hex: 'eab308' },
  { tw: 'bg-green-500', hex: '22c55e' },
  { tw: 'bg-teal-500', hex: '14b8a6' },
  { tw: 'bg-blue-500', hex: '3b82f6' },
  { tw: 'bg-purple-500', hex: 'a855f7' },
  { tw: 'bg-pink-500', hex: 'ec4899' },
  { tw: 'bg-gray-400', hex: '9ca3af' },
  { tw: 'bg-gray-800', hex: '1f2937' },
];

const GRID_SIZE = 80;

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function App() {
  const canvasRef = useRef(null);

  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);

  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const [drawingLine, setDrawingLine] = useState(null);
  const [movingNodeId, setMovingNodeId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionBox, setSelectionBox] = useState(null);

  const [clipboard, setClipboard] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null);

  const [showExportCard, setShowExportCard] = useState(false);
  const [blueprintName, setBlueprintName] = useState("My Logic Circuit");
  const [blueprintDesc, setBlueprintDesc] = useState("Custom logic circuit exported from React");

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

  const getCanvasCoords = useCallback((rawX, rawY) => {
    return {
      x: (rawX - viewport.x) / viewport.zoom,
      y: (rawY - viewport.y) / viewport.zoom
    };
  }, [viewport]);

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

  const handleExport = async () => {
    const idMap = new Map();
    nodes.forEach((node, index) => idMap.set(node.id, index));

    const minX = Math.min(...nodes.map(n => n.x));
    // FIXED: The right edge of the wooden board now properly accounts for components that are 2 blocks wide!
    const maxX = Math.max(...nodes.map(n => {
      const compDef = COMPONENTS.find((g) => g.type === n.type);
      return n.x + (compDef.w || 1) - 1;
    }));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxY = Math.max(...nodes.map(n => n.y));

    const woodenBoard = {
      shapeId: "df953d9c-234f-4ac2-af5e-f0490b223e71",
      bounds: { x: (maxX - minX) + 3, y: (maxY - minY) + 3, z: 1 },
      color: "df7f50",
      pos: { x: minX - 1, y: minY - 1, z: -1 },
      xaxis: 1, zaxis: 3
    };

    const smChilds = nodes.map((node) => {
      const compDef = COMPONENTS.find((g) => g.type === node.type);
      const outgoingWires = connections.filter((c) => c.fromId === node.id);
      const linkedControllers = outgoingWires.map((wire) => ({ id: idMap.get(wire.toId) }));

      const controllerData = {
        active: false,
        controllers: linkedControllers,
        id: idMap.get(node.id)
      };

      if (compDef.category === 'gate') {
        controllerData.mode = compDef.mode;
      } else if (compDef.type === 'TIMER') {
        controllerData.ticks = node.ticks !== undefined ? node.ticks : 40;
      }

      const shapeObj = {
        shapeId: compDef.shapeId || "9f0f56e8-2c31-4d83-996c-d00a9b296c3f",
        pos: { x: node.x, y: node.y, z: 0 },
        xaxis: 1, zaxis: -2,
        controller: controllerData
      };

      if (node.colorHex) shapeObj.color = node.colorHex;

      return shapeObj;
    });

    smChilds.unshift(woodenBoard);

    const blueprintData = { bodies: [{ childs: smChilds }], version: 4 };
    const descriptionData = {
      description: blueprintDesc || "No description provided.",
      localId: generateUUID(),
      name: blueprintName || "Unnamed Circuit",
      type: "Blueprint",
      version: 0
    };

    const zip = new JSZip();
    zip.file("blueprint.json", JSON.stringify(blueprintData, null, 2));
    zip.file("description.json", JSON.stringify(descriptionData, null, 2));

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);

    const safeFilename = blueprintName.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_') || 'blueprint';
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFilename}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setShowExportCard(false);
  };

  const createCurvePath = (x1, y1, x2, y2) => {
    const distX = Math.abs(x2 - x1);
    const distY = Math.abs(y2 - y1);
    const verticalSlack = distY * 0.4;
    const isBackward = x1 > x2 - 20;
    const minSlack = isBackward ? 150 : 60 + verticalSlack;
    const offset = Math.max(distX * 0.5, minSlack);
    return `M ${x1} ${y1} C ${x1 + offset} ${y1}, ${x2 - offset} ${y2}, ${x2} ${y2}`;
  };

  const handleButtonZoom = (direction) => {
    const zoomSensitivity = 1.25;
    let newZoom = viewport.zoom * (direction > 0 ? zoomSensitivity : (1 / zoomSensitivity));
    newZoom = Math.min(Math.max(0.1, newZoom), 5);

    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const scaleRatio = newZoom / viewport.zoom;
    const newX = centerX - (centerX - viewport.x) * scaleRatio;
    const newY = centerY - (centerY - viewport.y) * scaleRatio;

    setViewport({ x: newX, y: newY, zoom: newZoom });
  };

  const handleWheel = (e) => {
    const zoomSensitivity = 1.1;
    const direction = e.deltaY < 0 ? 1 : -1;
    let newZoom = viewport.zoom * (direction > 0 ? zoomSensitivity : (1 / zoomSensitivity));
    newZoom = Math.min(Math.max(0.1, newZoom), 5);

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const scaleRatio = newZoom / viewport.zoom;
    const newX = mouseX - (mouseX - viewport.x) * scaleRatio;
    const newY = mouseY - (mouseY - viewport.y) * scaleRatio;

    setViewport({ x: newX, y: newY, zoom: newZoom });
  };

  const handleCanvasMouseDown = (e) => {
    if (editingNodeId) setEditingNodeId(null);

    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
      e.preventDefault();
      setIsPanning(true);
      return;
    }

    if (e.button === 0 && !isSimulating) {
      const rect = e.currentTarget.getBoundingClientRect();
      const canvasPos = getCanvasCoords(e.clientX - rect.left, e.clientY - rect.top);
      setSelectionBox({ startX: canvasPos.x, startY: canvasPos.y, endX: canvasPos.x, endY: canvasPos.y });
      setSelectedIds([]);
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (isPanning) {
      setViewport(prev => ({ ...prev, x: prev.x + e.movementX, y: prev.y + e.movementY }));
      return;
    }
    if (isSimulating) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const canvasPos = getCanvasCoords(e.clientX - rect.left, e.clientY - rect.top);

    if (drawingLine) {
      setDrawingLine({ ...drawingLine, endX: canvasPos.x, endY: canvasPos.y });
    } else if (movingNodeId) {
      const cellX = Math.floor(canvasPos.x / GRID_SIZE);
      const cellY = Math.floor(canvasPos.y / GRID_SIZE);

      const primaryNode = nodes.find(n => n.id === movingNodeId);
      if (primaryNode) {
        const dx = cellX - primaryNode.x;
        const dy = cellY - primaryNode.y;

        if (dx !== 0 || dy !== 0) {
          setNodes(nodes.map(n =>
            selectedIds.includes(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n
          ));
        }
      }
    } else if (selectionBox) {
      setSelectionBox({ ...selectionBox, endX: canvasPos.x, endY: canvasPos.y });
    }
  };

  const handleCanvasMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isSimulating) {
      setNodes(nodes.map(n => n.type === 'BUTTON' ? { ...n, active: false } : n));
      return;
    }

    if (drawingLine) {
      const endCellX = Math.floor(drawingLine.endX / GRID_SIZE);
      const endCellY = Math.floor(drawingLine.endY / GRID_SIZE);

      // FIXED: Snapping a wire now works perfectly if you drop it on the left OR right side of a 2-block wide Timer!
      const targetNode = nodes.find(n => {
        const compDef = COMPONENTS.find(c => c.type === n.type);
        const w = compDef.w || 1;
        return endCellY === n.y && endCellX >= n.x && endCellX < n.x + w;
      });

      if (targetNode && targetNode.id !== drawingLine.fromId) {
        const exists = connections.some(c => c.fromId === drawingLine.fromId && c.toId === targetNode.id);
        if (!exists) setConnections([...connections, { id: Date.now(), fromId: drawingLine.fromId, toId: targetNode.id }]);
      }
      setDrawingLine(null);
    }

    if (movingNodeId) setMovingNodeId(null);

    if (selectionBox) {
      const minX = Math.min(selectionBox.startX, selectionBox.endX);
      const maxX = Math.max(selectionBox.startX, selectionBox.endX);
      const minY = Math.min(selectionBox.startY, selectionBox.endY);
      const maxY = Math.max(selectionBox.startY, selectionBox.endY);

      const foundNodes = nodes.filter(n => {
        const compDef = COMPONENTS.find(c => c.type === n.type);
        const nodeWidth = (compDef.w || 1) * GRID_SIZE;
        const nodeCenterX = (n.x * GRID_SIZE) + (nodeWidth / 2);
        const nodeCenterY = (n.y * GRID_SIZE) + (GRID_SIZE / 2);
        return nodeCenterX >= minX && nodeCenterX <= maxX && nodeCenterY >= minY && nodeCenterY <= maxY;
      });
      setSelectedIds(foundNodes.map(n => n.id));
      setSelectionBox(null);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-gray-900 text-white font-sans overflow-hidden">

      <div className="w-64 bg-gray-800 border-r border-gray-700 p-4 flex flex-col z-20 select-none shadow-xl overflow-y-auto">
        <h1 className="text-xl font-bold text-blue-400 mb-6 shrink-0">Logic Exporter</h1>

        <div className={`transition-opacity ${isSimulating ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
          <h2 className="text-sm font-bold text-gray-400 mb-3 shrink-0">Logic Gates</h2>
          <div className="flex flex-wrap gap-3 mb-6 shrink-0">
            {COMPONENTS.filter(c => c.category === 'gate').map((comp) => (
              <div
                key={comp.type}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('gateType', comp.type)}
                className={`${comp.color} w-[3.25rem] h-[3.25rem] rounded flex items-center justify-center font-bold text-xs cursor-grab active:cursor-grabbing shadow-sm hover:brightness-110 transition-all border-2 border-transparent hover:border-white/20`}
              >
                {comp.type}
              </div>
            ))}
          </div>

          <h2 className="text-sm font-bold text-gray-400 mb-3 shrink-0">Interactables</h2>
          <div className="flex flex-wrap gap-3 mb-8 shrink-0">
            {/* FIXED: The sidebar palette now visually represents width! Button/Switch are 1x1 squares, Timer is a 1x2 rectangle. */}
            {COMPONENTS.filter(c => c.category === 'interactable').map((comp) => (
              <div
                key={comp.type}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('gateType', comp.type)}
                className={`${comp.color} ${comp.w === 2 ? 'w-[7.25rem]' : 'w-[3.25rem]'} h-[3.25rem] rounded flex items-center justify-center font-bold text-xs cursor-grab active:cursor-grabbing shadow-sm hover:brightness-110 transition-all border-2 border-transparent hover:border-white/20`}
              >
                {comp.type}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto space-y-3 text-xs text-gray-500 shrink-0">
          <p><strong>Pan:</strong> Space+Drag or Mid-Click</p>

          <div className="h-px bg-gray-700 w-full my-4"></div>

          <button
            onClick={() => {
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
            }}
            className={`w-full py-3 rounded font-bold transition-colors shadow-lg active:scale-95 ${isSimulating ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
          >
            {isSimulating ? '■ Stop Simulation' : '▶ Start Simulation'}
          </button>

          <button
            onClick={triggerExport}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-base rounded font-bold transition-colors shadow-lg active:scale-95"
          >
            Export Blueprint...
          </button>
        </div>
      </div>

      <div
        ref={canvasRef}
        className={`flex-1 relative overflow-hidden ${isSpacePressed ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(55, 65, 81, 0.4) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(55, 65, 81, 0.4) 1px, transparent 1px)
          `,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          backgroundSize: `${GRID_SIZE * viewport.zoom}px ${GRID_SIZE * viewport.zoom}px`,
        }}
        onWheel={handleWheel}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          if (isSimulating) return;
          const type = e.dataTransfer.getData('gateType');
          if (!type) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const canvasPos = getCanvasCoords(e.clientX - rect.left, e.clientY - rect.top);

          const cellX = Math.floor(canvasPos.x / GRID_SIZE);
          const cellY = Math.floor(canvasPos.y / GRID_SIZE);
          setNodes([...nodes, { id: Date.now(), type, x: cellX, y: cellY }]);
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!isSimulating) setContextMenu({ x: e.clientX, y: e.clientY });
        }}
        onMouseLeave={() => {
          if (drawingLine) setDrawingLine(null);
          if (movingNodeId) setMovingNodeId(null);
          if (selectionBox) setSelectionBox(null);
          setIsPanning(false);
        }}
      >
        <div
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`, transformOrigin: '0 0' }}
        >
          <svg className="absolute top-0 left-0 pointer-events-none overflow-visible" style={{ width: '100%', height: '100%' }}>
            {connections.map((conn) => {
              const fromNode = nodes.find((n) => n.id === conn.fromId);
              const toNode = nodes.find((n) => n.id === conn.toId);
              if (!fromNode || !toNode) return null;

              const fromCompDef = COMPONENTS.find((c) => c.type === fromNode.type);
              const isWireActive = isSimulating && fromNode.active;

              // FIXED: The wire correctly draws outward from the absolute far right edge, even if the node is 2 grid blocks wide!
              return (
                <path
                  key={conn.id}
                  d={createCurvePath(
                    (fromNode.x * GRID_SIZE) + ((fromCompDef?.w || 1) * GRID_SIZE) - 5,
                    (fromNode.y * GRID_SIZE) + 40,
                    (toNode.x * GRID_SIZE) + 5,
                    (toNode.y * GRID_SIZE) + 40
                  )}
                  stroke={isWireActive ? "#fbbf24" : "#60A5FA"}
                  strokeWidth={isWireActive ? "6" : "4"}
                  fill="none"
                  className={`drop-shadow-md transition-all duration-75 ${isWireActive ? 'opacity-100' : 'opacity-80'}`}
                />
              );
            })}
            {drawingLine && (
              <path
                d={createCurvePath(drawingLine.startX, drawingLine.startY, drawingLine.endX, drawingLine.endY)}
                stroke="#9CA3AF" strokeWidth="4" strokeDasharray="8,8" fill="none" className="opacity-70"
              />
            )}
            {selectionBox && (
              <rect
                x={Math.min(selectionBox.startX, selectionBox.endX)}
                y={Math.min(selectionBox.startY, selectionBox.endY)}
                width={Math.abs(selectionBox.endX - selectionBox.startX)}
                height={Math.abs(selectionBox.endY - selectionBox.startY)}
                fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" strokeWidth="1"
              />
            )}
          </svg>

          {nodes.map((node) => {
            const compDef = COMPONENTS.find((g) => g.type === node.type);
            const isSelected = selectedIds.includes(node.id);
            const isEditing = editingNodeId === node.id;

            const isActive = isSimulating && node.active;
            const activeGlow = isActive ? 'ring-4 ring-yellow-400 brightness-125 shadow-[0_0_15px_rgba(251,191,36,0.8)]' : 'border-2 border-white/20 shadow-lg';

            return (
              <div
                key={node.id}
                onMouseDown={(e) => {
                  if (isSpacePressed) return;
                  e.stopPropagation();
                  if (e.button !== 0) return;

                  if (isSimulating) {
                    if (node.type === 'SWITCH') {
                      setNodes(nodes.map(n => n.id === node.id ? { ...n, active: !n.active } : n));
                    } else if (node.type === 'BUTTON') {
                      setNodes(nodes.map(n => n.id === node.id ? { ...n, active: true } : n));
                    }
                    return;
                  }

                  const isMultiSelect = e.ctrlKey || e.metaKey || e.shiftKey;
                  if (isMultiSelect) {
                    if (selectedIds.includes(node.id)) {
                      setSelectedIds(selectedIds.filter(id => id !== node.id));
                    } else {
                      setSelectedIds([...selectedIds, node.id]);
                    }
                  } else {
                    if (!selectedIds.includes(node.id)) setSelectedIds([node.id]);
                    setMovingNodeId(node.id);
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (!isSimulating) setEditingNodeId(node.id);
                }}
                className={`absolute ${node.colorTw || compDef.color} rounded flex items-center justify-center font-bold text-xs select-none transition-all pointer-events-auto ${isSimulating ? (node.type === 'SWITCH' || node.type === 'BUTTON' ? 'cursor-pointer' : 'cursor-default') : 'cursor-move'} ${isSelected && !isSimulating ? 'ring-4 ring-white z-20 scale-105' : activeGlow + ' z-10'}`}
                // FIXED: The physical canvas node will stretch nicely to occupy exactly the number of grid cells defined in components.w!
                style={{
                  left: (node.x * GRID_SIZE) + 8,
                  top: (node.y * GRID_SIZE) + 8,
                  width: ((compDef.w || 1) * GRID_SIZE) - 16,
                  height: GRID_SIZE - 16
                }}
              >
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-4 h-4 bg-gray-800 border-2 border-gray-400 rounded-full cursor-default hover:bg-white hover:scale-125 transition-all" />

                {!isEditing && (
                  <div className="flex flex-col items-center justify-center pointer-events-none drop-shadow-md">
                    <span>{node.type}</span>
                    {compDef.type === 'TIMER' && (
                      <span className="text-[10px] opacity-75 -mt-1 font-mono tracking-tighter">
                        {((node.ticks !== undefined ? node.ticks : 40) / 40).toFixed(2).replace(/\.00$/, '')}s
                      </span>
                    )}
                  </div>
                )}

                {!isSimulating && (
                  <div
                    className="absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-4 bg-gray-800 border-2 border-gray-400 rounded-full cursor-crosshair hover:bg-white hover:scale-125 transition-all"
                    onMouseDown={(e) => {
                      if (isSpacePressed) return;
                      e.stopPropagation();
                      if (e.button !== 0) return;
                      setDrawingLine({
                        fromId: node.id,
                        startX: (node.x * GRID_SIZE) + ((compDef.w || 1) * GRID_SIZE) - 5,
                        startY: (node.y * GRID_SIZE) + 40,
                        endX: (node.x * GRID_SIZE) + ((compDef.w || 1) * GRID_SIZE) - 5,
                        endY: (node.y * GRID_SIZE) + 40
                      });
                    }}
                  />
                )}

                {isEditing && !isSimulating && (
                  <div
                    className="absolute bottom-[4.5rem] left-1/2 -translate-x-1/2 bg-gray-800 p-3 rounded shadow-2xl z-50 flex flex-col gap-3 border border-gray-600 cursor-default"
                    onMouseDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    {compDef.category === 'gate' && (
                      <select
                        value={node.type}
                        onChange={(e) => {
                          setNodes(nodes.map(n => n.id === node.id ? { ...n, type: e.target.value } : n));
                        }}
                        className="bg-gray-900 border border-gray-600 text-white text-sm p-1.5 rounded outline-none focus:border-blue-500 w-full"
                      >
                        {COMPONENTS.filter(c => c.category === 'gate').map(g => (
                          <option key={g.type} value={g.type}>{g.type}</option>
                        ))}
                      </select>
                    )}

                    {compDef.type === 'TIMER' && (
                      <div className="flex flex-col gap-3 w-48">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-8">Sec:</span>
                          <input
                            type="range" min="0" max="60"
                            value={Math.floor((node.ticks !== undefined ? node.ticks : 40) / 40)}
                            onChange={(e) => {
                              const s = parseInt(e.target.value) || 0;
                              const t = (node.ticks !== undefined ? node.ticks : 40) % 40;
                              setNodes(nodes.map(n => n.id === node.id ? { ...n, ticks: (s * 40) + t } : n));
                            }}
                            className="flex-1 accent-teal-500"
                          />
                          <input
                            type="number" min="0"
                            value={Math.floor((node.ticks !== undefined ? node.ticks : 40) / 40)}
                            onChange={(e) => {
                              const s = Math.max(0, parseInt(e.target.value) || 0);
                              const t = (node.ticks !== undefined ? node.ticks : 40) % 40;
                              setNodes(nodes.map(n => n.id === node.id ? { ...n, ticks: (s * 40) + t } : n));
                            }}
                            className="bg-gray-900 border border-gray-600 text-white text-xs w-10 p-1 text-center rounded outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-8">Tick:</span>
                          <input
                            type="range" min="0" max="39"
                            value={(node.ticks !== undefined ? node.ticks : 40) % 40}
                            onChange={(e) => {
                              const t = parseInt(e.target.value) || 0;
                              const s = Math.floor((node.ticks !== undefined ? node.ticks : 40) / 40);
                              setNodes(nodes.map(n => n.id === node.id ? { ...n, ticks: (s * 40) + t } : n));
                            }}
                            className="flex-1 accent-teal-500"
                          />
                          <input
                            type="number" min="0" max="39"
                            value={(node.ticks !== undefined ? node.ticks : 40) % 40}
                            onChange={(e) => {
                              const t = Math.min(39, Math.max(0, parseInt(e.target.value) || 0));
                              const s = Math.floor((node.ticks !== undefined ? node.ticks : 40) / 40);
                              setNodes(nodes.map(n => n.id === node.id ? { ...n, ticks: (s * 40) + t } : n));
                            }}
                            className="bg-gray-900 border border-gray-600 text-white text-xs w-10 p-1 text-center rounded outline-none"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex gap-1.5 justify-center mt-1 border-t border-gray-700 pt-3">
                      {PALETTE.map(c => (
                        <div
                          key={c.hex}
                          onClick={() => setNodes(nodes.map(n => n.id === node.id ? { ...n, colorTw: c.tw, colorHex: c.hex } : n))}
                          className={`w-5 h-5 rounded-full cursor-pointer border-2 transition-transform hover:scale-110 ${c.tw} ${node.colorTw === c.tw || (!node.colorTw && compDef.color === c.tw) ? 'border-white scale-110' : 'border-transparent'}`}
                        />
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => setEditingNodeId(null)}
                        className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded text-xs font-bold transition-colors w-full"
                      >
                        OK
                      </button>
                    </div>

                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-gray-800"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="absolute bottom-6 right-6 flex flex-col bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-30 overflow-hidden">
          <button onClick={() => handleButtonZoom(1)} className="w-10 h-10 flex items-center justify-center hover:bg-gray-700 active:bg-gray-600 text-gray-300 hover:text-white transition-colors border-b border-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          </button>
          <button onClick={() => handleButtonZoom(-1)} className="w-10 h-10 flex items-center justify-center hover:bg-gray-700 active:bg-gray-600 text-gray-300 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
          </button>
        </div>
      </div>

      {contextMenu && (
        <div className="fixed bg-gray-800 border border-gray-600 rounded shadow-2xl py-1 z-50 min-w-[120px]" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <button onClick={handleCopy} className="w-full text-left px-4 py-2 hover:bg-blue-600 transition-colors text-sm">Copy</button>
          <button onClick={handlePaste} disabled={clipboard.length === 0} className="w-full text-left px-4 py-2 hover:bg-blue-600 transition-colors text-sm disabled:opacity-50">Paste</button>
          <div className="h-px bg-gray-600 my-1 mx-2"></div>
          <button onClick={handleDelete} className="w-full text-left px-4 py-2 hover:bg-red-600 transition-colors text-sm text-red-400 hover:text-white">Delete</button>
        </div>
      )}

      {showExportCard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl p-6 w-96 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-white">Export Blueprint</h2>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-400">Creation Name</label>
              <input
                type="text"
                value={blueprintName}
                onChange={(e) => setBlueprintName(e.target.value)}
                className="bg-gray-900 border border-gray-600 rounded p-2 text-white outline-none focus:border-blue-500 transition-colors"
                placeholder="My Logic Circuit"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-400">Description</label>
              <textarea
                value={blueprintDesc}
                onChange={(e) => setBlueprintDesc(e.target.value)}
                className="bg-gray-900 border border-gray-600 rounded p-2 text-white outline-none focus:border-blue-500 transition-colors h-24 resize-none"
                placeholder="Created with Logic Exporter..."
              />
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowExportCard(false)} className="px-4 py-2 rounded font-bold text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleExport} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold transition-colors shadow-lg active:scale-95">
                Download ZIP
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}