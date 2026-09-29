import { SleepStage } from '../model';
import { buildSleepSessions, stageMinutes, unionDuration } from '../sleep';

const H = 3600000;
const t0 = Date.UTC(2026, 8, 28, 22);
const iv = (stage: SleepStage, fromH: number, toH: number) => ({
  stage,
  startAt: t0 + fromH * H,
  endAt: t0 + toH * H,
});

describe('ricostruzione del sonno', () => {
  it('unione degli intervalli: niente doppi conteggi', () => {
    expect(unionDuration([iv(1, 0, 2), iv(1, 1, 3), iv(1, 5, 6)])).toBe(4 * H);
  });

  it('iPhone + Watch sovrapposti: con fasi dettagliate l\'"asleep" generico viene ignorato', () => {
    const sessions = buildSleepSessions(
      [
        iv(SleepStage.InBed, 0, 8), // iPhone
        iv(SleepStage.Asleep, 0.5, 7.5), // iPhone (generico)
        iv(SleepStage.Light, 0.5, 3), // Watch
        iv(SleepStage.Deep, 3, 4.5),
        iv(SleepStage.Awake, 4.5, 4.75),
        iv(SleepStage.REM, 4.75, 7),
      ],
      'apple_health',
    );
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.asleepS).toBe(6.25 * 3600);
    expect(sessions[0]?.inBedS).toBe(8 * 3600);
    expect(stageMinutes(sessions[0]?.stages ?? [])).toMatchObject({
      [SleepStage.Deep]: 90,
      [SleepStage.REM]: 135,
    });
  });

  it('separa notti diverse e scarta i riposini troppo brevi', () => {
    const sessions = buildSleepSessions(
      [iv(SleepStage.Asleep, 0, 7), iv(SleepStage.Asleep, 16, 16.3), iv(SleepStage.Asleep, 24, 31)],
      'x',
    );
    expect(sessions.map((s) => s.asleepS / 3600)).toEqual([7, 7]);
  });
});
