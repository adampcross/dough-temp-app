import { useMemo, useState } from 'react';

export default function DoughTempCalculator() {
  const [form, setForm] = useState({
    flourKg: 42.5,
    waterKg: 30,
    targetFinalTemp: 23,
    frictionRise: 2,
    warmWaterTemp: 25,
    chilledWaterTemp: 5,
    warmFlourTemp: 25,
    chilledFlourTemp: 25,
    maxChilledWaterL: 70,
    maxChilledFlourKg: 0,
  });

  const parseNum = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const result = useMemo(() => {
    const flourKg = parseNum(form.flourKg);
    const waterKg = parseNum(form.waterKg);
    const targetFinalTemp = parseNum(form.targetFinalTemp);
    const frictionRise = parseNum(form.frictionRise);
    const warmWaterTemp = parseNum(form.warmWaterTemp);
    const chilledWaterTemp = parseNum(form.chilledWaterTemp);
    const warmFlourTemp = parseNum(form.warmFlourTemp);
    const chilledFlourTemp = parseNum(form.chilledFlourTemp);
    const maxChilledWaterL = parseNum(form.maxChilledWaterL);
    const maxChilledFlourKg = parseNum(form.maxChilledFlourKg);

    const targetPreFrictionTemp = targetFinalTemp - frictionRise;
    const totalMass = flourKg + waterKg;

    if (flourKg <= 0 || waterKg < 0 || totalMass <= 0) {
      return { error: 'Enter valid flour and water amounts.' };
    }

    const targetHeat = targetPreFrictionTemp * totalMass;
    const flourHeatAllWarm = flourKg * warmFlourTemp;

    const chilledWaterNeeded =
      (targetHeat - flourHeatAllWarm - waterKg * warmWaterTemp) /
      (chilledWaterTemp - warmWaterTemp);

    let chilledWater = chilledWaterNeeded;
    let warmWater = waterKg - chilledWater;
    let chilledFlour = 0;
    let warmFlour = flourKg;
    let feasible = true;
    let message = '';

    if (chilledWater < 0) {
      chilledWater = 0;
      warmWater = waterKg;
      message =
        'No chilled water is required. Warm water alone is sufficient or the dough may still be too cold depending on flour temperature.';
    }

    if (chilledWater > waterKg) {
      chilledWater = waterKg;
      warmWater = 0;

      const remainingHeatAfterAllChilledWater =
        targetHeat - waterKg * chilledWaterTemp;

      const chilledFlourNeeded =
        (remainingHeatAfterAllChilledWater - flourKg * warmFlourTemp) /
        (chilledFlourTemp - warmFlourTemp);

      chilledFlour = chilledFlourNeeded;
      warmFlour = flourKg - chilledFlour;
    }

    if (chilledWater > maxChilledWaterL + 1e-9) {
      feasible = false;
      message = `Not feasible with the current chilled water limit. Required chilled water is ${chilledWater.toFixed(2)} L, but the limit is ${maxChilledWaterL.toFixed(2)} L.`;
    }

    if (chilledFlour > maxChilledFlourKg + 1e-9) {
      feasible = false;
      message = `Not feasible with the current chilled flour limit. Required chilled flour is ${chilledFlour.toFixed(2)} kg, but the limit is ${maxChilledFlourKg.toFixed(2)} kg.`;
    }

    if (warmWater < -1e-9 || warmFlour < -1e-9) {
      feasible = false;
      message = 'Not feasible with the temperatures and quantities provided.';
    }

    const actualInitialTemp = feasible
      ? (
          (warmFlour * warmFlourTemp +
            chilledFlour * chilledFlourTemp +
            warmWater * warmWaterTemp +
            chilledWater * chilledWaterTemp) /
          totalMass
        )
      : null;

    const actualFinalTemp =
      feasible && actualInitialTemp !== null
        ? actualInitialTemp + frictionRise
        : null;

    return {
      feasible,
      message,
      targetPreFrictionTemp,
      chilledWater: Math.max(0, chilledWater),
      warmWater: Math.max(0, warmWater),
      chilledFlour: Math.max(0, chilledFlour),
      warmFlour: Math.max(0, warmFlour),
      actualInitialTemp,
      actualFinalTemp,
    };
  }, [form]);

  const fields = [
    ['flourKg', 'Total flour (kg)'],
    ['waterKg', 'Total water (kg)'],
    ['targetFinalTemp', 'Target final dough temp (°C)'],
    ['frictionRise', 'Mixer friction rise (°C)'],
    ['warmWaterTemp', 'Warm water temp (°C)'],
    ['chilledWaterTemp', 'Chilled water temp (°C)'],
    ['warmFlourTemp', 'Warm flour temp (°C)'],
    ['chilledFlourTemp', 'Chilled flour temp (°C)'],
    ['maxChilledWaterL', 'Max chilled water available (L)'],
    ['maxChilledFlourKg', 'Max chilled flour available (kg)'],
  ];

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      <h1>Dough Temperature Calculator</h1>
      <p>
        Enter your flour, water and temperature values. The calculator solves for the minimum chilled water needed to hit the target final dough temperature.
      </p>

      <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: '1fr 1fr' }}>
        <section style={{ border: '1px solid #ccc', borderRadius: '12px', padding: '20px' }}>
          <h2>Inputs</h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {fields.map(([key, label]) => (
              <label key={key} style={{ display: 'grid', gap: '6px' }}>
                <span>{label}</span>
                <input
                  type="number"
                  step="0.01"
                  value={form[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  style={{ padding: '10px', fontSize: '16px' }}
                />
              </label>
            ))}
          </div>
        </section>

        <section style={{ border: '1px solid #ccc', borderRadius: '12px', padding: '20px' }}>
          <h2>Result</h2>

          {result.error ? (
            <div>{result.error}</div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              <div><strong>Target pre-friction temp:</strong> {result.targetPreFrictionTemp.toFixed(2)} °C</div>
              <div><strong>Estimated final dough temp:</strong> {result.actualFinalTemp !== null ? `${result.actualFinalTemp.toFixed(2)} °C` : '—'}</div>
              <div><strong>Warm water:</strong> {result.warmWater.toFixed(2)} L</div>
              <div><strong>Chilled water:</strong> {result.chilledWater.toFixed(2)} L</div>
              <div><strong>Warm flour:</strong> {result.warmFlour.toFixed(2)} kg</div>
              <div><strong>Chilled flour:</strong> {result.chilledFlour.toFixed(2)} kg</div>

              <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', background: result.feasible ? '#e8f7ee' : '#fff4e5' }}>
                <strong>{result.feasible ? 'Feasible mix' : 'Constraint issue'}</strong>
                <p>
                  {result.feasible
                    ? `Use ${result.warmWater.toFixed(2)} L of warm water and ${result.chilledWater.toFixed(2)} L of chilled water. This gives an initial mix temperature of ${result.actualInitialTemp?.toFixed(2)} °C and an estimated final dough temperature of ${result.actualFinalTemp?.toFixed(2)} °C after ${parseNum(form.frictionRise).toFixed(2)} °C friction.`
                    : result.message}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}