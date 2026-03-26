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
    levainInputMode: 'weight',
    levainWeightKg: 0,
    levainPercentOfFlour: 20,
    levainTemp: 25,
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

    const targetPreFrictionTemp = targetFinalTemp - frictionRise;
    const totalMass = flourKg + waterKg + levainWeightKg;

    if (flourKg <= 0 || waterKg < 0 || levainWeightKg < 0 || totalMass <= 0) {
      return { error: 'Enter valid flour, water and levain amounts.' };
    }

    const maxUsableChilledWater = Math.min(waterKg, maxChilledWaterL);
    const maxUsableChilledFlour = Math.min(flourKg, maxChilledFlourKg);

    const coldestAchievableInitialTemp =
      ((flourKg - maxUsableChilledFlour) * warmFlourTemp +
        maxUsableChilledFlour * chilledFlourTemp +
        (waterKg - maxUsableChilledWater) * warmWaterTemp +
        maxUsableChilledWater * chilledWaterTemp +
        levainHeat) /
      totalMass;

    const coldestAchievableFinalTemp = coldestAchievableInitialTemp + frictionRise;

    let feasible = coldestAchievableInitialTemp <= targetPreFrictionTemp + 1e-9;
    let chilledWater = 0;
    let warmWater = waterKg;
    let chilledFlour = 0;
    let warmFlour = flourKg;
    let message = '';

    if (feasible) {
      const targetHeat = targetPreFrictionTemp * totalMass;
      const waterTempSpread = chilledWaterTemp - warmWaterTemp;

      if (Math.abs(waterTempSpread) < 1e-9) {
        const allWarmInitialTemp =
          (flourKg * warmFlourTemp + waterKg * warmWaterTemp + levainHeat) / totalMass;

        if (allWarmInitialTemp <= targetPreFrictionTemp + 1e-9) {
          chilledWater = 0;
          warmWater = waterKg;
          message = 'No chilled water is required.';
        } else {
          feasible = false;
          message = 'Target not achievable because warm and chilled water are at the same temperature.';
        }
      } else {
        const flourHeatAllWarm = flourKg * warmFlourTemp;
        let requiredChilledWater =
          (targetHeat - flourHeatAllWarm - levainHeat - waterKg * warmWaterTemp) /
          waterTempSpread;

        if (!Number.isFinite(requiredChilledWater)) {
          feasible = false;
          message = 'Target not achievable with the temperatures provided.';
        } else if (requiredChilledWater <= 0) {
          chilledWater = 0;
          warmWater = waterKg;
          message = 'No chilled water is required.';
        } else if (requiredChilledWater <= maxUsableChilledWater + 1e-9) {
          chilledWater = requiredChilledWater;
          warmWater = waterKg - requiredChilledWater;
        } else {
          feasible = false;
          message = 'Target not achievable with the current chilled water limit.';
        }
      }
    } else {
      message = 'Target not achievable with the current flour, water and levain temperatures and chilled ingredient limits.';
    }

    const actualInitialTemp = feasible
      ? (
          (warmFlour * warmFlourTemp +
            chilledFlour * chilledFlourTemp +
            warmWater * warmWaterTemp +
            chilledWater * chilledWaterTemp +
            levainHeat) /
          totalMass
        )
      : null;

    const actualFinalTemp = actualInitialTemp !== null ? actualInitialTemp + frictionRise : null;

    let maxWarmFlourTempForTarget = null;
    let flourCoolingNeeded = null;

    if (!feasible && flourKg > maxUsableChilledFlour) {
      const nonChilledFlourKg = flourKg - maxUsableChilledFlour;
      const targetHeat = targetPreFrictionTemp * totalMass;
      const fixedHeat =
        (waterKg - maxUsableChilledWater) * warmWaterTemp +
        maxUsableChilledWater * chilledWaterTemp +
        maxUsableChilledFlour * chilledFlourTemp +
        levainHeat;

      maxWarmFlourTempForTarget = (targetHeat - fixedHeat) / nonChilledFlourKg;
      flourCoolingNeeded = warmFlourTemp - maxWarmFlourTempForTarget;
    }

    return {
      feasible,
      message,
      targetPreFrictionTemp,
      chilledWater,
      warmWater,
      chilledFlour,
      warmFlour,
      actualInitialTemp,
      actualFinalTemp,
      coldestAchievableInitialTemp,
      coldestAchievableFinalTemp,
      maxWarmFlourTempForTarget,
      flourCoolingNeeded,
      levainWeightKg,
      levainFlourKg,
      levainWaterKg,
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
    ['levainTemp', 'Levain temp (°C)'],
    ['maxChilledWaterL', 'Max chilled water available (L)'],
    ['maxChilledFlourKg', 'Max chilled flour available (kg)'],
  ];

  const card = 'bg-white rounded-2xl shadow-sm border border-slate-200';
  const inputCls = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto grid gap-4 md:gap-6">
        <div className="grid gap-2">
          <h1 className="text-2xl md:text-4xl font-semibold tracking-tight">Dough Temperature Calculator</h1>
          <p className="text-sm md:text-base text-slate-600 max-w-3xl">
            Enter your flour, water and levain values. Levain is assumed to be 100% hydration.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
          <section className={`${card} p-4 md:p-6`}>
            <h2 className="text-lg md:text-xl font-semibold mb-4">Inputs</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-700 mb-3">Levain input mode</div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="levainInputMode"
                      checked={form.levainInputMode === 'weight'}
                      onChange={() => setField('levainInputMode', 'weight')}
                    />
                    Levain by weight (kg)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="levainInputMode"
                      checked={form.levainInputMode === 'percent'}
                      onChange={() => setField('levainInputMode', 'percent')}
                    />
                    Levain as % of flour
                  </label>
                </div>
              </div>

              {fields.map(([key, label]) => (
                <label key={key} className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    className={inputCls}
                    value={form[key]}
                    onChange={(e) => setField(key, e.target.value)}
                  />
                </label>
              ))}

              {form.levainInputMode === 'weight' ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">Levain weight (kg)</span>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    className={inputCls}
                    value={form.levainWeightKg}
                    onChange={(e) => setField('levainWeightKg', e.target.value)}
                  />
                </label>
              ) : (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">Levain as % of flour</span>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    className={inputCls}
                    value={form.levainPercentOfFlour}
                    onChange={(e) => setField('levainPercentOfFlour', e.target.value)}
                  />
                </label>
              )}
            </div>
          </section>

          <section className={`${card} p-4 md:p-6`}>
            <h2 className="text-lg md:text-xl font-semibold mb-4">Result</h2>

            {result.error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                {result.error}
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Metric label="Target pre-friction temp" value={`${result.targetPreFrictionTemp.toFixed(2)} °C`} />
                  <Metric label="Estimated final dough temp" value={result.actualFinalTemp !== null ? `${result.actualFinalTemp.toFixed(2)} °C` : '—'} />
                  <Metric label="Warm water" value={`${result.warmWater.toFixed(2)} L`} />
                  <Metric label="Chilled water" value={`${result.chilledWater.toFixed(2)} L`} />
                  <Metric label="Warm flour" value={`${result.warmFlour.toFixed(2)} kg`} />
                  <Metric label="Chilled flour" value={`${result.chilledFlour.toFixed(2)} kg`} />
                  <Metric label="Levain total" value={`${result.levainWeightKg.toFixed(2)} kg`} />
                  <Metric label="Levain flour / water" value={`${result.levainFlourKg.toFixed(2)} / ${result.levainWaterKg.toFixed(2)} kg`} />
                  {!result.feasible && (
                    <>
                      <Metric label="Coldest achievable final dough temp" value={`${result.coldestAchievableFinalTemp.toFixed(2)} °C`} />
                      <Metric label="Max warm flour temp to still hit target" value={result.maxWarmFlourTempForTarget !== null ? `${result.maxWarmFlourTempForTarget.toFixed(2)} °C` : '—'} />
                    </>
                  )}
                </div>

                <div className={`rounded-xl p-4 border ${result.feasible ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  <div className="font-medium mb-1">{result.feasible ? 'Feasible mix' : 'Constraint issue'}</div>
                  <p className="text-sm leading-6">
                    {result.feasible
                      ? `Use ${result.warmWater.toFixed(2)} L of warm water and ${result.chilledWater.toFixed(2)} L of chilled water. This gives an initial mix temperature of ${result.actualInitialTemp?.toFixed(2)} °C and an estimated final dough temperature of ${result.actualFinalTemp?.toFixed(2)} °C after ${parseNum(form.frictionRise).toFixed(2)} °C friction.`
                      : `${result.message} Coldest achievable final dough temperature with the available chilled ingredients is ${result.coldestAchievableFinalTemp.toFixed(2)} °C.${result.maxWarmFlourTempForTarget !== null ? ` To still hit the target, the warm flour would need to be at or below ${result.maxWarmFlourTempForTarget.toFixed(2)} °C.` : ''}${result.flourCoolingNeeded !== null ? ` Flour would need to be cooled by ${result.flourCoolingNeeded.toFixed(2)} °C.` : ''}`}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <h3 className="font-medium mb-2">Method</h3>
                  <p className="text-sm text-slate-600 leading-6 mb-3">
                    Levain is assumed to be 100% hydration, so its entered total weight is split evenly into flour and water at the levain temperature.
                  </p>
                  <p className="text-sm text-slate-600 leading-6">
                    The app checks feasibility first by calculating the coldest possible dough temperature using all available chilled water and chilled flour. Only if the target can be reached does it solve for the minimum chilled water required. If the target cannot be reached, it shows the coldest achievable final dough temperature and the highest flour temperature that would still make the target possible.
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
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm text-slate-600 mb-1">{label}</div>
      <div className="text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
