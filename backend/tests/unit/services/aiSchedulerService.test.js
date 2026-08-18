const { toMinutes, toTimeStr } = require("../../../services/aiSchedulerService");

describe("AI Scheduler Service", () => {
  describe("Time Helpers", () => {
    it("toMinutes should convert HH:mm to minutes since midnight", () => {
      expect(toMinutes("00:00")).toBe(0);
      expect(toMinutes("09:30")).toBe(570);
      expect(toMinutes("23:59")).toBe(1439);
    });

    it("toTimeStr should convert minutes since midnight to HH:mm", () => {
      expect(toTimeStr(0)).toBe("00:00");
      expect(toTimeStr(570)).toBe("09:30");
      expect(toTimeStr(1439)).toBe("23:59");
    });
    
    it("should be reversible", () => {
      const timeStr = "14:45";
      expect(toTimeStr(toMinutes(timeStr))).toBe(timeStr);
    });
  });
});
