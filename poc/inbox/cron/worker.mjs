// 毎分の Cron Trigger が無料枠で発火するかを測るだけの使い捨て Worker
export default {
  async scheduled(event) {
    console.log("tick", new Date(event.scheduledTime).toISOString())
  },
}
