import { Link } from "react-router";
import { fmtMoney, imageUrl, type ShopItemDto } from "../../services/shopService";
import { itemInStock } from "./store";


export default function ProductCard({ item }: { item: ShopItemDto }) {
  const out = !itemInStock(item);
  const hasOptions = item.variants.length > 0 || item.addOns.length > 0;
  return (
    <Link
      to={`/shop/p/${item.id}`}
      className="group flex flex-col rounded-2xl border border-gray-200 bg-white overflow-hidden hover:shadow-md transition-shadow dark:border-gray-800 dark:bg-gray-900"
      data-testid="product-card"
    >
      <div className="aspect-square bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <img src={imageUrl(item.imagePath)} alt={item.name} loading="lazy"
          className={`h-full w-full object-cover group-hover:scale-[1.03] transition-transform ${item.imagePath ? "" : "opacity-60 p-6 object-contain"}`} />
      </div>
      <div className="p-3 flex flex-col gap-1 flex-1">
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.categoryName}</div>
        <div className="font-semibold text-sm leading-snug line-clamp-2">{item.name}</div>
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="font-bold">{fmtMoney(item.price)}{item.variants.length > 0 && <span className="text-xs font-normal text-gray-500">+</span>}</span>
          {out ? <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5 text-gray-500 dark:bg-gray-800">Sold out</span>
            : hasOptions ? <span className="text-xs text-brand-600 dark:text-brand-400">Options</span>
            : <span className="text-xs text-emerald-600 dark:text-emerald-400">Add</span>}
        </div>
      </div>
    </Link>
  );
}
