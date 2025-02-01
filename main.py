from settings import SettingsManager # type: ignore
from datetime import datetime, timedelta
import time
import os
import decky # type: ignore
import asyncio

settingsDir = os.environ["DECKY_PLUGIN_SETTINGS_DIR"]

decky.logger.info('Simple Timer: Settings path = {}'.format(os.path.join(settingsDir, 'settings.json')))
settings = SettingsManager(name="settings", settings_directory=settingsDir)
settings.read()

settings_key_subtle_mode="subtle_mode"
settings_key_recent_timers="recent_timers_seconds"
settings_key_timer_end="timer_end"

class Plugin:

    timer_task: any

    def get_time_difference(self, target_timestamp: datetime):
        return target_timestamp - time.time()
    
    # region: Settings
    async def settings_read(self):
        decky.logger.info('Reading settings')
        return settings.read()
    
    async def settings_commit(self):
        decky.logger.info('Saving settings')
        return settings.commit()
    
    async def settings_getSetting(self, key: str, defaults):
        decky.logger.info('Get {}'.format(key))
        return settings.getSetting(key, defaults)
    
    async def settings_setSetting(self, key: str, value):
        decky.logger.info('Set {}: {}'.format(key, value))
        return settings.setSetting(key, value)

    # endregion

    async def start_timer(self, seconds: int):
        decky.logger.info("Simple Timer: Starting Timer for {} seconds. Saving Recent Timers.".format(seconds))

        new_timers = await self.settings_getSetting(settings_key_recent_timers, [])
        if len(new_timers) > 4: 
            new_timers.pop()

        new_timers.insert(0, seconds)
        await self.settings_setSetting(settings_key_recent_timers, new_timers)
        await self.settings_commit()

        # Emits the event to the frontend
        await self.load_recents()

        self.seconds_remaining = seconds
        await self.load_remaining_seconds()

        # Stores the timestamp of the expected alarm end
        future_time = time.time() + seconds
        future_timestamp = datetime.fromtimestamp(future_time)

        await self.settings_setSetting(settings_key_timer_end, future_time)
        await self.settings_commit()

        self.timer_task = self.loop.create_task(self.timer_handler(future_timestamp))

    async def timer_handler(self, timer_end: datetime):
        self.seconds_remaining = self.get_time_difference(timer_end.timestamp())

        while self.seconds_remaining > 0:
            await asyncio.sleep(5)

            self.seconds_remaining = self.get_time_difference(timer_end.timestamp())

            if (self.seconds_remaining <= -10):
                await self.cancel_timer()
                await decky.emit("simple_timer_event", "Your timer has expired!", True)
                return

            await decky.emit("simple_timer_seconds_updated", self.seconds_remaining)
        
        self.seconds_remaining = 0
        await decky.emit("simple_timer_seconds_updated", self.seconds_remaining)

        subtle = await self.settings_getSetting(settings_key_subtle_mode, False)
        await decky.emit("simple_timer_event", "Your session has ended!", subtle)

    async def cancel_timer(self):
        self.seconds_remaining = 0
        await decky.emit("simple_timer_seconds_updated", self.seconds_remaining)
        if self.timer_task is not None:
            self.timer_task.cancel()
        
    async def load_recents(self):
        recent_timers = await self.settings_getSetting(settings_key_recent_timers, [])

        if len(recent_timers) == 0:
            decky.logger.info("Simple Timer did not detect any Recent Timers.")
        
        await decky.emit("simple_timer_refresh_recents", recent_timers)

    async def set_subtle_mode(self, subtle):
        await self.settings_setSetting(settings_key_subtle_mode, subtle)
        await self.settings_commit()
        await self.load_subtle_mode()

    async def load_subtle_mode(self):
        subtle = await self.settings_getSetting(settings_key_subtle_mode, False)
        await decky.emit("simple_timer_subtle", subtle)

    async def load_remaining_seconds(self):
        await decky.emit("simple_timer_seconds_updated", self.seconds_remaining)

    async def _main(self):
        self.loop = asyncio.get_event_loop()
        self.seconds_remaining = 0

        await self.settings_read()
        timer_end_ts = await self.settings_getSetting(settings_key_timer_end, None)

        if timer_end_ts is not None:
            future = datetime.fromtimestamp(timer_end_ts)
            self.seconds_remaining = self.get_time_difference(future.timestamp())
            if self.seconds_remaining <= 0:
                decky.logger.info("Found expired timer -- cancelling")
                await self.cancel_timer()
            else:
                decky.logger.info("Found existing timer -- resuming")
                await self.start_timer(self.seconds_remaining)

        await self.load_recents()
        await self.load_subtle_mode()

        decky.logger.info("Simple Timer has been initialised.")

    async def _unload(self):
        await self.cancel_timer()
        decky.logger.info("Simple Timer has been unloaded.")
        pass

    async def _uninstall(self):
        decky.logger.info("Simple Timer has been uninstalled.")
        pass

    async def _migration(self):
        decky.logger.info("Simple Timer is being migrated.")

        decky.migrate_logs(os.path.join(decky.DECKY_USER_HOME, ".config", "decky-simple-timer", "template.log"))
        decky.migrate_settings(
            os.path.join(decky.DECKY_HOME, "settings", "template.json"),
            os.path.join(decky.DECKY_USER_HOME, ".config", "decky-simple-timer"))

        decky.migrate_runtime(
            os.path.join(decky.DECKY_HOME, "template"),
            os.path.join(decky.DECKY_USER_HOME, ".local", "share", "decky-simple-timer"))
