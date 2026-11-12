import { COMPONENTS } from '../constants/gameData';

export default function Sidebar({ isSimulating, onToggleSimulation, onExport }) {
    return (
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
                <p><strong>Delete Wires:</strong> Right-click ports</p>

                <div className="h-px bg-gray-700 w-full my-4"></div>

                <button
                    onClick={onToggleSimulation}
                    className={`w-full py-3 rounded font-bold transition-colors shadow-lg active:scale-95 ${isSimulating ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                >
                    {isSimulating ? '■ Stop Simulation' : '▶ Start Simulation'}
                </button>

                <button
                    onClick={onExport}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-base rounded font-bold transition-colors shadow-lg active:scale-95"
                >
                    Export Blueprint...
                </button>
            </div>
        </div>
    );
}