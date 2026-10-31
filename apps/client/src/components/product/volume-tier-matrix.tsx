import type { VariantPrice } from '@/lib/types';
import { currentVariantPrices, priceLabel } from '@/lib/catalog-contract';
export function VolumeTierMatrix({ prices }: { prices: VariantPrice[] }) {
  const current = currentVariantPrices(prices);
  if (!current.length) return <p className="p-4 bg-slate-100 rounded-xl">Price on request</p>;
  return (
    <div className="space-y-3">
      {current.map((price) => (
        <div key={price.id} className="bg-white border rounded-xl p-4 space-y-2">
          <p className="text-lg font-bold">
            {priceLabel({
              type: price.type as 'fixed' | 'range' | 'on_request',
              min: price.min,
              max: price.max,
              currency: price.currency,
              unit: price.unit,
              valid_until: price.valid_until,
            })}
          </p>
          {price.trade_term && <p className="text-sm">Trade terms: {price.trade_term}</p>}
          {price.type !== 'on_request' && !!price.tiers.length && (
            <table className="w-full text-left text-sm">
              <caption className="text-left font-semibold">Quantity breaks</caption>
              <thead>
                <tr>
                  <th>Order quantity</th>
                  <th>Unit price</th>
                </tr>
              </thead>
              <tbody>
                {price.tiers.map((tier, index) => (
                  <tr key={index}>
                    <td>
                      {tier.min_quantity}{' '}
                      {tier.max_quantity ? `to under ${tier.max_quantity}` : 'and above'}{' '}
                      {tier.unit}
                    </td>
                    <td>
                      {price.currency} {Number(tier.unit_price).toLocaleString('en-BD')} /{' '}
                      {price.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {price.valid_until && (
            <p className="text-xs text-slate-500">
              Valid until{' '}
              {new Date(price.valid_until).toISOString().replace('T', ' ').replace('.000Z', ' UTC')}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
