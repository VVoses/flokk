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
    for seed in [1, 7, 17, 42, 79]:
        trips = page.evaluate('''seed => {
          st.mode='pause'; genWorld(seed); roadInit(); TRAIN=null; TRAFFIC=[]; spawnResidentCars();
          const results=[];
          for(const car of TRAFFIC) {
            const started=residentJourney(car);
            if(!started) {results.push({started:false});continue;}
            const owner=car.driver, home=car.home;
            // Saved journeys retain both owner/car links and the identity of the return destination.
            const restored=unpackSession(packSession({car})).car;
            const linked=restored.driver.vehicle===restored && restored.home.point[0]===home.point[0];
            let visited=false, moved=false, returnLink=false;
            for(let i=0;i<12000 && car.trip;i++) {
              arrivalLife(owner,.1); placeVehicle(car,.1);
              visited ||= car.stop===home; moved ||= car.engineOn && car.dist>50;
              if(car.stop===home && !returnLink) {
                const saved=unpackSession(packSession({car})).car;
                returnLink=saved.stop===saved.home && saved.driver.vehicle===saved;
              }
            }
            for(let i=0;i<1000 && !owner.hide;i++) arrivalLife(owner,.1);
            results.push({started,linked,visited,moved,returnLink,returned:!car.trip,
              bay:Math.hypot(wdx(car.x,home.point[0]),car.y-home.point[1])<1,
              quiet:!car.engineOn && car.v===0, indoors:owner.hide, same:car.driver===owner,
              debug:{s:car.s,length:car.route?.length,driverOut:car.driverOut,x:owner.x,y:owner.y}});
          }
          return results;
        }''', seed)
        assert trips, 'resident cars exist'
        for trip in trips:
            assert all(value for key,value in trip.items() if key != 'debug'), (seed,trip)
        print('resident trips, home bays and saved owner links passed', seed, len(trips))
    migrated = page.evaluate('''() => {
      const car=TRAFFIC[0];delete car.home;
      TRAFFIC_T=100;updateTraffic(0);
      return !!car.home && Math.hypot(wdx(car.x,car.home.point[0]),car.y-car.home.point[1])<1;
    }''')
    assert migrated, 'older resident-car saves acquire their home bay'
    browser.close()
print('driver return, boarding, door closure and reuse passed')
