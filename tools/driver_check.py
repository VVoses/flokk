"""A parked car retains its driver and waits for boarding before departure."""
from pathlib import Path
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto((Path(__file__).resolve().parent.parent / 'index.html').as_uri() + '?dev&seed=7')
    page.click('#startBtn')
    page.wait_for_function("st.mode === 'play' && !MENU_JOB")
    result = page.evaluate('''() => {
      st.mode = 'pause';
      const stop = vehicleDestinations()[0];
      const car = {kind:'car', x:stop.point[0], y:stop.point[1], ang:stop.ang || 0,
        hd:8.5, parkT:20, engineOn:false, v:0,
        route:makeJourney(stop.point, vehicleDestinations()[1].point), s:0};
      driverExit(car);
      const driver = car.driver;
      car.parkT = 0;
      placeVehicle(car, 0.1);
      const waiting = !car.engineOn && car.v === 0 && car.driverOut;
      for(let i=0; i<200 && car.driverOut; i++) arrivalLife(driver, 0.1);
      const boarded = !car.driverOut && driver.hide && car.doorT > 0;
      placeVehicle(car, 0.1);
      const closing = !car.engineOn;
      car.doorT = 0;
      placeVehicle(car, 0.1);
      const running = car.engineOn;
      car.driverOut = false;
      driverExit(car);
      const reused = car.driver === driver && !driver.hide && !driver.dying;
      return {waiting, boarded, closing, running, reused};
    }''')
    assert all(result.values()), result
    browser.close()
print('driver return, boarding, door closure and reuse passed')
