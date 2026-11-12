import { useState, useCallback, useRef } from 'react';
import { COMPONENTS, GRID_SIZE, PALETTE } from '../constants/gameData';

export default function GridCanvas({
    nodes, setNodes,
    connections, setConnections,
    isSimulating,
    isSpacePressed,
    selectedIds, setSelectedIds,
    editingNodeId, setEditingNodeId,
    setContextMenu
}) {
    const canvasRef = useRef(null);

    const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
    const [isPanning, setIsPanning] = useState(false);
    const [drawingLine, setDrawingLine] = useState(null);
    const [movingNodeId, setMovingNodeId] = useState(null);
    const [selectionBox, setSelectionBox] = useState(null);

    const getCanvasCoords = useCallback((rawX, rawY) => {
        return {
            x: (rawX - viewport.x) / viewport.zoom,
            y: (rawY - viewport.y) / viewport.zoom
        };
    }, [viewport]);

    const checkCollision = (targetX, targetY, width, ignoreIds = []) => {
        for (let i = 0; i < width; i++) {
            const cx = targetX + i;
            const hit = nodes.some(n => {
                if (ignoreIds.includes(n.id)) return false;
                const w = COMPONENTS.find(c => c.type === n.type)?.w || 1;
                return n.y === targetY && cx >= n.x && cx < n.x + w;
            });
            if (hit) return true;
        }
        return false;
    };

    const createCurvePath = (start, end) => {
        const margin = 30;
        const radius = 10;

        const getInitialStep = (pt) => {
            if (pt.dir === 'top') return { x: pt.x, y: pt.y - margin };
            if (pt.dir === 'bottom') return { x: pt.x, y: pt.y + margin };
            if (pt.dir === 'right') return { x: pt.x + margin, y: pt.y };
            return { x: pt.x - margin, y: pt.y };
        };

        const p1 = getInitialStep(start);
        const p2 = getInitialStep(end);

        let points = [start, p1];

        if (
            (start.dir === 'right' && end.dir === 'left' && p1.x < p2.x) ||
            (start.dir === 'left' && end.dir === 'right' && p1.x > p2.x) ||
            (start.dir === 'bottom' && end.dir === 'top' && p1.y < p2.y) ||
            (start.dir === 'top' && end.dir === 'bottom' && p1.y > p2.y)
        ) {
            if (start.dir === 'left' || start.dir === 'right') {
                const midX = (p1.x + p2.x) / 2;
                points.push({ x: midX, y: p1.y }, { x: midX, y: p2.y });
            } else {
                const midY = (p1.y + p2.y) / 2;
                points.push({ x: p1.x, y: midY }, { x: p2.x, y: midY });
            }
        }
        else {
            if (start.dir === 'left' || start.dir === 'right') {
                const midY = (p1.y + p2.y) / 2;
                points.push({ x: p1.x, y: midY }, { x: p2.x, y: midY });
            } else {
                const midX = (p1.x + p2.x) / 2;
                points.push({ x: midX, y: p1.y }, { x: midX, y: p2.y });
            }
        }

        points.push(p2, end);

        let path = `M ${points[0].x} ${points[0].y}`;

        for (let i = 1; i < points.length - 1; i++) {
            const curr = points[i];
            const next = points[i + 1];
            const prev = points[i - 1];

            const distNext = Math.sqrt((next.x - curr.x) ** 2 + (next.y - curr.y) ** 2);
            const distPrev = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
            const r = Math.min(radius, distNext / 2, distPrev / 2);

            if (r === 0) {
                path += ` L ${curr.x} ${curr.y}`;
                continue;
            }

            const dx1 = curr.x - prev.x;
            const dy1 = curr.y - prev.y;
            const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
            const arcStartX = curr.x - (dx1 / len1) * r;
            const arcStartY = curr.y - (dy1 / len1) * r;

            const dx2 = next.x - curr.x;
            const dy2 = next.y - curr.y;
            const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            const arcEndX = curr.x + (dx2 / len2) * r;
            const arcEndY = curr.y + (dy2 / len2) * r;

            path += ` L ${arcStartX} ${arcStartY} Q ${curr.x} ${curr.y} ${arcEndX} ${arcEndY}`;
        }

        path += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;

        return path;
    };

    const getPortCoords = (node, dir, compDef) => {
        const w = (compDef?.w || 1) * GRID_SIZE;
        const h = GRID_SIZE;
        const offset = 5;

        let px, py;
        if (dir === 'top') { px = w / 2; py = -offset; }
        else if (dir === 'bottom') { px = w / 2; py = h + offset; }
        else if (dir === 'right') { px = w + offset; py = h / 2; }
        else { px = -offset; py = h / 2; }

        return { x: (node.x * GRID_SIZE) + px, y: (node.y * GRID_SIZE) + py, dir };
    };

    const getPortClass = (dir, isInput) => {
        const base = `absolute w-4 h-4 bg-gray-800 border-2 border-gray-400 rounded-full transition-all z-20 `;
        const hover = isInput
            ? `hover:bg-red-500 hover:border-red-700 hover:scale-125 cursor-default`
            : `hover:bg-white hover:scale-125 cursor-crosshair`;

        if (dir === 'top') return base + hover + ` left-1/2 -top-3 -translate-x-1/2`;
        if (dir === 'bottom') return base + hover + ` left-1/2 -bottom-3 -translate-x-1/2`;
        if (dir === 'right') return base + hover + ` -right-3 top-1/2 -translate-y-1/2`;
        return base + hover + ` -left-3 top-1/2 -translate-y-1/2`;
    };

    const cycleDirection = (current, restricted) => {
        const dirs = ['left', 'top', 'right', 'bottom'];
        const idx = dirs.indexOf(current);
        let nextDir = dirs[(idx + 1) % dirs.length];

        if (nextDir === restricted) {
            nextDir = dirs[(idx + 2) % dirs.length];
        }
        return nextDir;
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
                    const compDef = COMPONENTS.find(c => c.type === primaryNode.type);
                    if (!checkCollision(cellX, cellY, compDef?.w || 1, selectedIds)) {
                        setNodes(nodes.map(n =>
                            selectedIds.includes(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n
                        ));
                    }
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

    // NEW: Helper to find the correct hex code for the wire based on the node's color
    const getNodeColorHex = (node, compDef) => {
        if (node.colorHex) return node.colorHex; // Custom painted color
        const tw = compDef?.color || '';
        const paletteMatch = PALETTE.find(p => p.tw === tw);
        if (paletteMatch) return paletteMatch.hex;
        if (tw.includes('yellow-600')) return 'ca8a04'; // Fallback for the switch
        return '60A5FA'; // Default blue
    };

    return (
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

                const w = COMPONENTS.find(c => c.type === type)?.w || 1;
                if (!checkCollision(cellX, cellY, w)) {
                    setNodes([...nodes, { id: Date.now(), type, x: cellX, y: cellY, inDir: 'left', outDir: 'right' }]);
                }
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
                {nodes.length > 0 && (() => {
                    const minX = Math.min(...nodes.map(n => n.x));
                    const maxX = Math.max(...nodes.map(n => {
                        const compDef = COMPONENTS.find(c => c.type === n.type);
                        return n.x + (compDef?.w || 1) - 1;
                    }));
                    const minY = Math.min(...nodes.map(n => n.y));
                    const maxY = Math.max(...nodes.map(n => n.y));

                    const boardX = minX - 1;
                    const boardY = minY - 1;
                    const boardW = (maxX - minX) + 3;
                    const boardH = (maxY - minY) + 3;

                    return (
                        <div
                            className="absolute bg-[#df7f50] border-b-8 border-r-8 border-t-2 border-l-2 border-[#b56036] rounded-sm transition-all duration-300 pointer-events-none drop-shadow-xl"
                            style={{
                                left: boardX * GRID_SIZE,
                                top: boardY * GRID_SIZE,
                                width: boardW * GRID_SIZE,
                                height: boardH * GRID_SIZE,
                                backgroundImage: `
                  repeating-linear-gradient(to right, transparent, transparent ${GRID_SIZE - 2}px, rgba(0,0,0,0.1) ${GRID_SIZE - 2}px, rgba(0,0,0,0.1) ${GRID_SIZE}px),
                  repeating-linear-gradient(to bottom, transparent, transparent ${GRID_SIZE - 2}px, rgba(0,0,0,0.05) ${GRID_SIZE - 2}px, rgba(0,0,0,0.05) ${GRID_SIZE}px)
                `
                            }}
                        />
                    );
                })()}

                <svg className="absolute top-0 left-0 pointer-events-none overflow-visible" style={{ width: '100%', height: '100%' }}>

                    {/* NEW: SVG Defs automatically generating an arrowhead for every color in the palette! */}
                    <defs>
                        <marker id="arrow-active" viewBox="0 0 10 10" refX="3.5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                            <path d="M 0 2 L 8 5 L 0 8 z" fill="#fbbf24" />
                        </marker>
                        <marker id="arrow-drawing" viewBox="0 0 10 10" refX="4" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                            <path d="M 0 2 L 8 5 L 0 8 z" fill="#9CA3AF" />
                        </marker>
                        <marker id="arrow-60A5FA" viewBox="0 0 10 10" refX="4" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                            <path d="M 0 2 L 8 5 L 0 8 z" fill="#60A5FA" />
                        </marker>
                        <marker id="arrow-ca8a04" viewBox="0 0 10 10" refX="4" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                            <path d="M 0 2 L 8 5 L 0 8 z" fill="#ca8a04" />
                        </marker>
                        {PALETTE.map(c => (
                            <marker key={c.hex} id={`arrow-${c.hex}`} viewBox="0 0 10 10" refX="4" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                                <path d="M 0 2 L 8 5 L 0 8 z" fill={`#${c.hex}`} />
                            </marker>
                        ))}
                    </defs>

                    {connections.map((conn) => {
                        const fromNode = nodes.find((n) => n.id === conn.fromId);
                        const toNode = nodes.find((n) => n.id === conn.toId);
                        if (!fromNode || !toNode) return null;

                        const fromDef = COMPONENTS.find((c) => c.type === fromNode.type);
                        const toDef = COMPONENTS.find((c) => c.type === toNode.type);

                        const startPt = getPortCoords(fromNode, fromNode.outDir || 'right', fromDef);
                        const endPt = getPortCoords(toNode, toNode.inDir || 'left', toDef);

                        const isWireActive = isSimulating && fromNode.active;
                        const wireHex = getNodeColorHex(fromNode, fromDef); // Extract the correct source color

                        return (
                            <path
                                key={conn.id}
                                d={createCurvePath(startPt, endPt)}
                                stroke={isWireActive ? "#fbbf24" : `#${wireHex}`}
                                strokeWidth={isWireActive ? "6" : "4"}
                                fill="none"
                                markerEnd={isWireActive ? "url(#arrow-active)" : `url(#arrow-${wireHex})`}
                                className={`drop-shadow-md transition-all duration-75 ${isWireActive ? 'opacity-100' : 'opacity-80'}`}
                            />
                        );
                    })}
                    {drawingLine && (
                        <path
                            d={createCurvePath(
                                { x: drawingLine.startX, y: drawingLine.startY, dir: drawingLine.startDir },
                                { x: drawingLine.endX, y: drawingLine.endY, dir: 'left' }
                            )}
                            stroke="#9CA3AF" strokeWidth="4" strokeDasharray="8,8" fill="none" className="opacity-70"
                            markerEnd="url(#arrow-drawing)"
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
                            style={{
                                left: (node.x * GRID_SIZE) + 8,
                                top: (node.y * GRID_SIZE) + 8,
                                width: ((compDef.w || 1) * GRID_SIZE) - 16,
                                height: GRID_SIZE - 16
                            }}
                        >
                            <div
                                className={getPortClass(node.inDir || 'left', true)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setConnections(connections.filter(c => c.toId !== node.id));
                                }}
                            />

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
                                    className={getPortClass(node.outDir || 'right', false)}
                                    onMouseDown={(e) => {
                                        if (isSpacePressed) return;
                                        e.stopPropagation();
                                        if (e.button !== 0) return;

                                        const startPt = getPortCoords(node, node.outDir || 'right', compDef);
                                        setDrawingLine({
                                            fromId: node.id,
                                            startX: startPt.x, startY: startPt.y, startDir: startPt.dir,
                                            endX: startPt.x, endY: startPt.y
                                        });
                                    }}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setConnections(connections.filter(c => c.fromId !== node.id));
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

                                    <div className="flex gap-2 justify-center border-t border-gray-700 pt-3 mt-1">
                                        <button
                                            onClick={() => setNodes(nodes.map(n => n.id === node.id ? { ...n, inDir: cycleDirection(n.inDir || 'left', n.outDir || 'right') } : n))}
                                            className="bg-gray-700 hover:bg-gray-600 text-xs px-2 py-1.5 rounded transition-colors flex-1 font-bold text-gray-300"
                                        >
                                            In: <span className="text-white uppercase">{node.inDir || 'left'}</span>
                                        </button>
                                        <button
                                            onClick={() => setNodes(nodes.map(n => n.id === node.id ? { ...n, outDir: cycleDirection(n.outDir || 'right', n.inDir || 'left') } : n))}
                                            className="bg-gray-700 hover:bg-gray-600 text-xs px-2 py-1.5 rounded transition-colors flex-1 font-bold text-gray-300"
                                        >
                                            Out: <span className="text-white uppercase">{node.outDir || 'right'}</span>
                                        </button>
                                    </div>

                                    <div className="flex justify-end mt-2">
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
    );
}