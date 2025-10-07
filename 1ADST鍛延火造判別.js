kintone.events.on(['app.record.create.change.工番', 'app.record.edit.change.工番'], function(event) {
  var record = event.record;
  var 工番 = record['工番'].value;

  if (工番.charAt(3) === 'D') {
    record['鍛延_火造'].value = '鍛延';
  } else {
    record['鍛延_火造'].value = '火造';
  }

  return event;
});
