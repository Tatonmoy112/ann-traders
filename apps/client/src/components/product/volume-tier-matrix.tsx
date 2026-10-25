import React from 'react';
import type { VariantPrice, PriceTier } from '@/lib/types';
import { Tag, TrendingDown, Clock, ShieldCheck } from 'lucide-react';

interface VolumeTierMatrixProps {
  prices: VariantPrice[];
}

export function VolumeTierMatrix({ prices }: VolumeTierMatrixProps) {
  if (!prices || prices.length === 0) {
    return (
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
        <div>
          <span className="font-bold text-slate-800 block">Commercial Pricing</span>
          <span>Spot & indent quotations provided upon spec submission.</span>
        </div>
        <span className="px-2.5 py-1 bg-blue-100 text-blue-700 font-bold rounded-lg text-xs">
          RFQ Basis
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {prices.map((price) => {
        const hasTiers = price.tiers && price.tiers.length > 0;

        return (
          <div
            key={price.id}
            className="bg-white rounded-2xl border border-blue-200/80 shadow-xs overflow-hidden"
          >
            {/* Header: Base Price & Currency */}
            <div className="p-4 bg-gradient-to-r from-blue-50/80 to-slate-50 border-b border-blue-100 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-blue-800 uppercase tracking-wider block">
                  Commercial Price Schedule
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-2xl font-black text-slate-900">
                    {price.currency} {price.min ? Number(price.min).toLocaleString() : ''}
                    {price.max && price.max !== price.min
                      ? ` – ${Number(price.max).toLocaleString()}`
                      : ''}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">/ {price.unit}</span>
                </div>
              </div>

              {price.trade_term && (
                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 bg-white border border-blue-200 text-blue-700 text-xs font-bold rounded-md shadow-2xs">
                    {price.trade_term}
                  </span>
                </div>
              )}
            </div>

            {/* Volume Tier Discount Breakdown Table */}
            {hasTiers ? (
              <div className="p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 mb-2.5">
                  <TrendingDown className="w-4 h-4 text-emerald-600" />
                  <span>Factory Volume Discount Matrix:</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="py-2 pr-4">Order Quantity</th>
                        <th className="py-2 pr-4">Unit Price</th>
                        <th className="py-2 text-right">Commercial Advantage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {price.tiers.map((tier: PriceTier, tIdx: number) => {
                        const isBestValue = tIdx === price.tiers.length - 1 && price.tiers.length > 1;

                        return (
                          <tr
                            key={tIdx}
                            className={`hover:bg-slate-50/80 transition ${
                              isBestValue ? 'bg-emerald-50/40 font-semibold' : ''
                            }`}
                          >
                            <td className="py-2.5 pr-4 text-slate-800">
                              {tier.min_quantity}
                              {tier.max_quantity ? ` – ${tier.max_quantity}` : '+'} {price.unit}s
                            </td>
                            <td className="py-2.5 pr-4 font-mono font-bold text-slate-900">
                              {price.currency} {Number(tier.unit_price).toLocaleString()} / {price.unit}
                            </td>
                            <td className="py-2.5 text-right">
                              {isBestValue ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  Best Commercial Value
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[11px]">Factory Gate Rate</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {/* Validity notice */}
            {price.valid_until && (
              <div className="px-4 py-2 bg-slate-50/60 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Price schedule valid through {new Date(price.valid_until).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

