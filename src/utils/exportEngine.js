import JSZip from 'jszip';
import { COMPONENTS } from '../constants/gameData';

const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export const generateBlueprintZip = async (nodes, connections, blueprintName, blueprintDesc) => {
    const idMap = new Map();
    nodes.forEach((node, index) => idMap.set(node.id, index));

    const minX = Math.min(...nodes.map(n => n.x));
    const maxX = Math.max(...nodes.map(n => {
        const compDef = COMPONENTS.find((g) => g.type === n.type);
        return n.x + (compDef?.w || 1) - 1;
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
};