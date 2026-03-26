import { useMemo, useState } from 'react';

export default function DoughTempCalculator() {
  const [form, setForm] = useState({
    flourKg: '42.5',
    waterKg: '30',
    targetFinalTemp: '23',
    frictionRise: '2',
    warmWaterTemp: '25',
    chilledWaterTemp: '5',
    warmFlourTemp: '25',
    chilledFlourTemp: '25',
    maxChilledWaterL: '70',
    maxChilledFlourKg: '0',
    levainInputMode: 'weight',
    levainWeightKg: '0',
    levainPercentOfFlour: '20',
    levainTemp: '25',
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
    const levainTemp = parseNum(form.levainTemp);

    const levainWeightKg =
      form.levainInputMode === 'percent'
        ? flourKg * (parseNum(form.levainPercentOfFlour) / 100)
        : parseNum(form.levainWeightKg);

    const levainFlourKg = levainWeightKg / 2;
    const levainWaterKg = levainWeightKg / 2;
    const levainHeat = levainWeightKg * levainTemp;

    if (flourKg <= 0 || waterKg < 0 || levainWeightKg < 0) {
      return { error: 'Enter valid flour, water and levain amounts.' };
    }

    const totalMass = flourKg + waterKg + levainWeightKg;
    if (totalMass <= 0) {
      return { error: 'Total mix weight must be greater than zero.' };
    }

    const targetPreFrictionTemp = targetFinalTemp - frictionRise;
    const maxUsableChilledWater = Math.min(waterKg, Math.max(0, maxChilledWaterL));
    const maxUsableChilledFlour = Math.min(flourKg, Math.max(0, maxChilledFlourKg));

    const warmestAchievableInitialTemp =
      (flourKg * warmFlourTemp + waterKg * warmWaterTemp + levainHeat) / totalMass;

    const warmestAchievableFinalTemp = warmestAchievableInitialTemp + frictionRise;

    const waterOnlyColdestInitialTemp =
      (flourKg * warmFlourTemp +
        (waterKg - maxUsableChilledWater) * warmWaterTemp +
        maxUsableChilledWater * chilledWaterTemp +
        levainHeat) /
      totalMass;

    const coldestAchievableInitialTemp =
      ((flourKg - maxUsableChilledFlour) * warmFlourTemp +
        maxUsableChilledFlour * chilledFlourTemp +
        (waterKg - maxUsableChilledWater) * warmWaterTemp +
        maxUsableChilledWater * chilledWaterTemp +
        levainHeat) /
      totalMass;

    const coldestAchievableFinalTemp = coldestAchievableInitialTemp + frictionRise;

    let feasible = true;
    let feasibilityType = 'feasible';
    let message = '';

    let chilledWaterUsed = 0;
    let warmWaterUsed = waterKg;
    let chilledFlourUsed = 0;
    let warmFlourUsed = flourKg;

    const targetHeat = targetPreFrictionTemp * totalMass;
    const tolerance = 1e-9;

    if (targetPreFrictionTemp > warmestAchievableInitialTemp + tolerance) {
      feasible = false;
      feasibilityType = 'too_hot';
      message =
        'Target not achievable because it is above the warmest dough temperature possible with the current ingredient temperatures.';
    } else if (targetPreFrictionTemp < coldestAchievableInitialTemp - tolerance) {
      feasible = false;
      feasibilityType = 'too_cold';
      message =
        'Target not achievable because it is below the coldest dough temperature possible with the available chilled ingredients.';
    } else {
      // Target is achievable somewhere between warmest and coldest.
      // Operational preference:
      // 1) use warm flour only
      // 2) use minimum chilled water needed
      // 3) only use chilled flour if all usable chilled water is already fully used and more cooling is still needed

      if (targetPreFrictionTemp >= waterOnlyColdestInitialTemp - tolerance) {
        // Water-only solution
        const waterSpread = chilledWaterTemp - warmWaterTemp;

        if (Math.abs(waterSpread) < tolerance) {
          // Water split cannot change dough temp
          chilledWaterUsed = 0;
          warmWaterUsed = waterKg;
        } else {
          const requiredChilledWater =
            (targetHeat -
              flourKg * warmFlourTemp -
              waterKg * warmWaterTemp -
              levainHeat) /
            waterSpread;

          if (
            !Number.isFinite(requiredChilledWater) ||
            requiredChilledWater < -tolerance ||
            requiredChilledWater > maxUsableChilledWater + tolerance
          ) {
            feasible = false;
            feasibilityType = 'calculation_error';
            message = 'A valid chilled water split could not be calculated from the inputs.';
          } else {
            chilledWaterUsed = Math.max(0, Math.min(maxUsableChilledWater, requiredChilledWater));
            warmWaterUsed = waterKg - chilledWaterUsed;
          }
        }
      } else {
        // Need all usable chilled water, then use chilled flour for the rest
        chilledWaterUsed = maxUsableChilledWater;
        warmWaterUsed = waterKg - chilledWaterUsed;

        const flourSpread = chilledFlourTemp - warmFlourTemp;

        if (Math.abs(flourSpread) < tolerance) {
          feasible = false;
          feasibilityType = 'calculation_error';
          message = 'A valid chilled flour split could not be calculated from the inputs.';
        } else {
          const requiredChilledFlour =
            (targetHeat -
              levainHeat -
              warmWaterUsed * warmWaterTemp -
              chilledWaterUsed * chilledWaterTemp -
              flourKg * warmFlourTemp) /
            flourSpread;

          if (
            !Number.isFinite(requiredChilledFlour) ||
            requiredChilledFlour < -tolerance ||
            requiredChilledFlour > maxUsableChilledFlour + tolerance
          ) {
            feasible = false;
            feasibilityType = 'calculation_error';
            message = 'A valid chilled flour split could not be calculated from the inputs.';
          } else {
            chilledFlourUsed = Math.max(0, Math.min(maxUsableChilledFlour, requiredChilledFlour));
            warmFlourUsed = flourKg - chilledFlourUsed;
          }
        }
      }
    }

    const actualInitialTemp =
      feasible
        ? (
            warmFlourUsed * warmFlourTemp +
            chilledFlourUsed * chilledFlourTemp +
            warmWaterUsed * warmWaterTemp +
            chilledWaterUsed * chilledWaterTemp +
            levainHeat
          ) / totalMass
        : null;

    const actualFinalTemp =
      actualInitialTemp !== null ? actualInitialTemp + frictionRise : null;

    let maxWarmFlourTempForTarget = null;
    let flourCoolingNeeded = null;

    // Only really meaningful for "too cold" situations where all usable chilled water is already assumed fully used
    if (!feasible && feasibilityType === 'too_cold') {
      const nonChilledFlourKg = flourKg - maxUsableChilledFlour;

      if (nonChilledFlourKg > tolerance) {
        maxWarmFlourTempForTarget =
          (targetHeat -
            levainHeat -
            (waterKg - maxUsableChilledWater) * warmWaterTemp -
            maxUsableChilledWater * chilledWaterTemp -
            maxUsableChilledFlour * chilledFlourTemp) /
          nonChilledFlourKg;

        if (Number.isFinite(maxWarmFlourTempForTarget)) {
          flourCoolingNeeded = warmFlourTemp - maxWarmFlourTempForTarget;
        } else {
          maxWarmFlourTempForTarget = null;
          flourCoolingNeeded = null;
        }
      }
    }

let warnings = [];

if (levainWeightKg <= 0.0001) {
  warnings.push('Levain is set to 0. Confirm this is intentional.');
}

if (waterKg <= 0.0001) {
  warnings.push('Water is set to 0. Confirm this is intentional.');
}

if (
  warmWaterTemp === chilledWaterTemp &&
  warmFlourTemp === chilledFlourTemp
) {
  warnings.push(
    'No temperature difference between warm and chilled ingredients. You have no control over dough temperature.'
  );
}
    return {
      feasible,
      feasibilityType,
      message,
      warnings,
      targetPreFrictionTemp,
      actualInitialTemp,
      actualFinalTemp,
      warmestAchievableInitialTemp,
      warmestAchievableFinalTemp,
      coldestAchievableInitialTemp,
      coldestAchievableFinalTemp,
      warmWaterUsed,
      chilledWaterUsed,
      warmFlourUsed,
      chilledFlourUsed,
      levainWeightKg,
      levainFlourKg,
      levainWaterKg,
      maxWarmFlourTempForTarget,
      flourCoolingNeeded,
      debug: {
        waterOnlyColdestInitialTemp,
      },
    };
  }, [form]);

  const numberFields = [
    ['flourKg', 'Total flour (kg)'],
    ['waterKg', 'Total water (kg)'],
    ['targetFinalTemp', 'Target final dough temp (°C)'],
    ['frictionRise', 'Mixer friction rise (°C)'],
    ['warmWaterTemp', 'Warm water temp (°C)'],
    ['chilledWaterTemp', 'Chilled water temp (°C)'],
    ['warmFlourTemp', 'Warm flour temp (°C)'],
    ['chilledFlourTemp', 'Chilled flour temp (°C)'],
    ['levainTemp', 'Levain temp (°C)'],
    ['maxChilledWaterL', 'Max chilled water available (L)'],
    ['maxChilledFlourKg', 'Max chilled flour available (kg)'],
  ];

  return (
    <div className="app-shell">
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }

        .app-shell {
          min-height: 100vh;
          background: #f1f5f9;
          color: #0f172a;
          font-family: Arial, sans-serif;
          padding: 16px;
        }

        .container {
          max-width: 1120px;
          margin: 0 auto;
        }

        .header {
          margin-bottom: 18px;
        }

        .title {
          margin: 0 0 8px 0;
          font-size: 30px;
          line-height: 1.1;
          font-weight: 700;
        }

        .subtitle {
          margin: 0;
          color: #475569;
          font-size: 15px;
          line-height: 1.5;
        }

        .layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }

        .card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 18px;
          box-shadow: 0 2px 10px rgba(15, 23, 42, 0.05);
        }

        .section-title {
          margin: 0 0 16px 0;
          font-size: 24px;
          font-weight: 700;
        }

        .mode-box {
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 14px;
          background: #f8fafc;
          margin-bottom: 16px;
        }

        .mode-label {
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 10px;
        }

        .radio-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 10px;
          font-size: 16px;
        }

        .input-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }

        .field {
          display: grid;
          gap: 8px;
        }

        .label {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
        }

        .input {
          width: 100%;
          border: 2px solid #d1d5db;
          border-radius: 16px;
          padding: 16px;
          font-size: 18px;
          background: #fff;
          color: #0f172a;
          outline: none;
        }

        .input:focus {
          border-color: #94a3b8;
        }

        .result-stack {
          display: grid;
          gap: 16px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .metric {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 16px;
          padding: 14px;
        }

        .metric-label {
          font-size: 13px;
          color: #475569;
          margin-bottom: 6px;
        }

        .metric-value {
          font-size: 24px;
          line-height: 1.2;
          font-weight: 700;
        }

        .notice {
          border-radius: 16px;
          padding: 16px;
          border: 1px solid;
        }

        .notice.success {
          background: #ecfdf5;
          border-color: #a7f3d0;
          color: #065f46;
        }

        .notice.warning {
          background: #fffbeb;
          border-color: #fcd34d;
          color: #92400e;
        }

        .notice-title {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .notice-text {
          margin: 0;
          font-size: 15px;
          line-height: 1.6;
        }

        .method-box {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 16px;
          padding: 16px;
        }

        .method-title {
          margin: 0 0 10px 0;
          font-size: 18px;
          font-weight: 700;
        }

        .method-text {
          margin: 0 0 10px 0;
          color: #475569;
          font-size: 14px;
          line-height: 1.6;
        }

        .method-text:last-child {
          margin-bottom: 0;
        }

        @media (min-width: 900px) {
          .layout {
            grid-template-columns: minmax(380px, 1fr) minmax(360px, 1fr);
          }

          .input-grid {
            grid-template-columns: 1fr 1fr;
          }

          .metrics-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>

      <div className="container">
        <div className="header">
          <h1 className="title">Dough Temperature Calculator</h1>
          <p className="subtitle">
            Levain is assumed to be 100% hydration. Flour and water inputs are treated as the
            main mix inputs, with levain added on top at its own temperature.
          </p>
        </div>

        <div className="layout">
          <section className="card">
            <h2 className="section-title">Inputs</h2>

            <div className="mode-box">
              <div className="mode-label">Levain input mode</div>

              <label className="radio-row">
                <input
                  type="radio"
                  name="levainInputMode"
                  checked={form.levainInputMode === 'weight'}
                  onChange={() => setField('levainInputMode', 'weight')}
                />
                <span>Levain by weight (kg)</span>
              </label>

              <label className="radio-row">
                <input
                  type="radio"
                  name="levainInputMode"
                  checked={form.levainInputMode === 'percent'}
                  onChange={() => setField('levainInputMode', 'percent')}
                />
                <span>Levain as % of flour</span>
              </label>
            </div>

            <div className="input-grid">
              {numberFields.map(([key, label]) => (
                <label key={key} className="field">
                  <span className="label">{label}</span>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={form[key]}
                    onChange={(e) => setField(key, e.target.value)}
                  />
                </label>
              ))}

              {form.levainInputMode === 'weight' ? (
                <label className="field">
                  <span className="label">Levain weight (kg)</span>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={form.levainWeightKg}
                    onChange={(e) => setField('levainWeightKg', e.target.value)}
                  />
                </label>
              ) : (
                <label className="field">
                  <span className="label">Levain as % of flour</span>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={form.levainPercentOfFlour}
                    onChange={(e) => setField('levainPercentOfFlour', e.target.value)}
                  />
                </label>
              )}
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">Result</h2>

            {result.error ? (
              <div className="notice warning">
                <div className="notice-title">Input issue</div>
                <p className="notice-text">{result.error}</p>
              </div>
            ) : (
              <div className="result-stack">
                <div className="metrics-grid">
                  <Metric
                    label="Target pre-friction temp"
                    value={`${result.targetPreFrictionTemp.toFixed(2)} °C`}
                  />
                  <Metric
                    label="Estimated final dough temp"
                    value={
                      result.actualFinalTemp !== null
                        ? `${result.actualFinalTemp.toFixed(2)} °C`
                        : '—'
                    }
                  />
                  <Metric
                    label="Warm water"
                    value={`${result.warmWaterUsed.toFixed(2)} L`}
                  />
                  <Metric
                    label="Chilled water"
                    value={`${result.chilledWaterUsed.toFixed(2)} L`}
                  />
                  <Metric
                    label="Warm flour"
                    value={`${result.warmFlourUsed.toFixed(2)} kg`}
                  />
                  <Metric
                    label="Chilled flour"
                    value={`${result.chilledFlourUsed.toFixed(2)} kg`}
                  />
                  <Metric
                    label="Levain total"
                    value={`${result.levainWeightKg.toFixed(2)} kg`}
                  />
                  <Metric
                    label="Levain flour / water"
                    value={`${result.levainFlourKg.toFixed(2)} / ${result.levainWaterKg.toFixed(2)} kg`}
                  />

                  {!result.feasible && result.feasibilityType === 'too_cold' && (
                    <>
                      <Metric
                        label="Coldest achievable final dough temp"
                        value={`${result.coldestAchievableFinalTemp.toFixed(2)} °C`}
                      />
                      <Metric
                        label="Max warm flour temp to still hit target"
                        value={
                          result.maxWarmFlourTempForTarget !== null
                            ? `${result.maxWarmFlourTempForTarget.toFixed(2)} °C`
                            : '—'
                        }
                      />
                    </>
                  )}

                  {!result.feasible && result.feasibilityType === 'too_hot' && (
                    <Metric
                      label="Warmest achievable final dough temp"
                      value={`${result.warmestAchievableFinalTemp.toFixed(2)} °C`}
                    />
                  )}
                </div>

                <div className={`notice ${result.feasible ? 'success' : 'warning'}`}>
                  <div className="notice-title">
                    {result.feasible ? 'Feasible mix' : 'Constraint issue'}
                  </div>

                  <p className="notice-text">
                    {result.feasible
                      ? `Use ${result.warmWaterUsed.toFixed(2)} L of warm water and ${result.chilledWaterUsed.toFixed(2)} L of chilled water. Use ${result.warmFlourUsed.toFixed(2)} kg of warm flour and ${result.chilledFlourUsed.toFixed(2)} kg of chilled flour. This gives an initial mix temperature of ${result.actualInitialTemp?.toFixed(2)} °C and an estimated final dough temperature of ${result.actualFinalTemp?.toFixed(2)} °C after ${parseNum(form.frictionRise).toFixed(2)} °C friction.`
                      : result.feasibilityType === 'too_cold'
                        ? `${result.message} The coldest achievable final dough temperature is ${result.coldestAchievableFinalTemp.toFixed(2)} °C.${result.maxWarmFlourTempForTarget !== null ? ` To still hit the target, the warm flour would need to be at or below ${result.maxWarmFlourTempForTarget.toFixed(2)} °C.` : ''}${result.flourCoolingNeeded !== null ? ` Flour would need to be cooled by ${result.flourCoolingNeeded.toFixed(2)} °C.` : ''}`
                        : result.feasibilityType === 'too_hot'
                          ? `${result.message} The warmest achievable final dough temperature is ${result.warmestAchievableFinalTemp.toFixed(2)} °C.`
                          : result.message}
                  </p>
                </div>

                <div className="method-box">
                  <h3 className="method-title">Method</h3>
                  <p className="method-text">
                    Levain is assumed to be 100% hydration, so its entered total weight is split
                    evenly into flour and water at the levain temperature.
                  </p>
                  <p className="method-text">
                    The app first checks the warmest and coldest dough temperatures possible with
                    the ingredient temperatures and chilled ingredient limits. It only solves for
                    the ingredient split if the target is actually reachable.
                  </p>
                  <p className="method-text">
                    Operationally, it prefers warm flour first, then uses the minimum chilled water
                    needed. It only uses chilled flour if all usable chilled water is already fully
                    applied and the dough still needs to be colder.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}