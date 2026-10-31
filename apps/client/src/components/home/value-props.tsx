export function ValueProps() {
  const items = [
    [
      'Product specifications',
      'Compare materials, variants and their published technical attributes.',
    ],
    [
      'Clear units',
      'Check the sale unit, minimum order quantity and any published quantity breaks.',
    ],
    ['Technical references', 'Ask about the documents relevant to your application and product.'],
    [
      'Discuss requirements',
      'Confirm availability, quotation validity and delivery terms with us.',
    ],
  ];
  return (
    <section className="bg-slate-900 text-white py-12">
      <div className="container-custom grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {items.map(([title, text]) => (
          <div key={title}>
            <h2 className="font-bold mb-2">{title}</h2>
            <p className="text-sm text-slate-300">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
