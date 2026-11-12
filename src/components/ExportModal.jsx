import { useState, useEffect } from 'react';

export default function ExportModal({ onClose, onExport }) {
    const [blueprintName, setBlueprintName] = useState("My Logic Circuit");
    const [blueprintDesc, setBlueprintDesc] = useState("Custom logic circuit exported from React");

    // Pressing Escape closes the modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
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
                    <button onClick={onClose} className="px-4 py-2 rounded font-bold text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={() => onExport(blueprintName, blueprintDesc)}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold transition-colors shadow-lg active:scale-95"
                    >
                        Download ZIP
                    </button>
                </div>
            </div>
        </div>
    );
}