const fs = require('fs');
let path = 'apps/tests/structuresTests/adl_tree.test.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/expect\(lpMapLength\)\.toBe\(1\);/g, 
`expect(lpMapLength).toBe(1);

    const pos = market.positionsRef.values().next().value.value;
    const currentLp = pos.liquidationPrice;
    
    // The keys in longsMap should match the actual current liquidation price of the position
    expect(market.longs.has(currentLp)).toBe(true);`);

fs.writeFileSync(path, code);
