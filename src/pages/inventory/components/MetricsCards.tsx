// Metrics Cards Component
interface MetricsCardsProps {
    totalProducts: number;
    totalStock: number;
    lowStockCount: number;
}

export function MetricsCards({ totalProducts, totalStock, lowStockCount }: MetricsCardsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-800/50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold text-slate-300 mb-3">Total Products</h2>
                <p className="text-4xl font-bold text-white">{totalProducts}</p>
            </div>
            <div className="bg-slate-800/50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold text-slate-300 mb-3">Total Stock</h2>
                <p className="text-4xl font-bold text-white">{totalStock}</p>
            </div>
            <div className="bg-slate-800/50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold text-slate-300 mb-3">Low Stock Items</h2>
                <p className="text-4xl font-bold text-white">{lowStockCount}</p>
            </div>
        </div>
    );
}

