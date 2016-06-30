var RATE_OF_RETURN = 0.725
var planData = [];

var start = function() {
  // pull in all the participant data from the csv
  d3.csv('../data_src/all_pensions_data2016.csv')
      .get(function(error, rows) {  //callback after loading
          planData = translateTotalsDataToPlanObjects(rows)
          var contributionPayrollRatios = [10, 20, 30, 40, 50]
          for (var j=0;  j < planData.length; j++) {
              var planRow = planData[j];
              var graphData = [];
              var rawData = [];
              for (var i=0; i < contributionPayrollRatios.length; i++) {
                  var ratio = contributionPayrollRatios[i];
                  var revisedData = reviseFundingRatio(ratio, planRow);
                  rawData.push({ratio: ratio, yearlyData: revisedData});
                  graphData.push(transformDataToGraphData(revisedData, 'Year', 'FundingRatio', planRow.fund, ratio))
              }
              graphData.push(transformDataToGraphData(planRow.totalsData, 'Year', 'FundingRatio', planRow.fund, 'Actuarial Recommendation'))
              planRow.graphData = graphData;
              //buildGraph(graphData)
          }
          setupDropDown();
          for(var i=0; i < planData.length; i++) {
            if(planData[i].fund == 'Total') buildGraph(planData[i].graphData, planData[i].fund);
          }
      });
}

/*  example record:
{AAL: "328.00", AllInactives: "23.07", Assets: "65.69", Beneficiaries: "21.03", Debt_Service: "3.39", Employee_Contribution: "1.34", FutureTier2: "0.23", Inactives: "2.04", Payroll: "11.63", State_Contribution: "22.46", System: "GARS", Tier1: "5.00", Tier2: "0.22", Total: "28.52", Year: "2026"}
*/

function setupDropDown() {
  var inputNode = $('#planChoice');
  for(var i=0; i < planData.length; i++) {
    inputNode.append("<option>" + planData[i].fund + "</option>")
  }
  inputNode.append("<option>List of Plans</option>")
  inputNode.on('change', function() {
    var val = this.value;
    $("#chart1").empty();
    if (val == "List of Plans") {
      for(var i=0; i < planData.length; i++) {
        buildGraph(planData[i].graphData, planData[i].fund);
      }
    }
    else {
      for(var i=0; i < planData.length; i++) {
        if(planData[i].fund == val) buildGraph(planData[i].graphData, planData[i].fund);
      }
    }
  })
}
var pension_plans_formatted = [
  {fund: 'GARS', assets: 52564685, funded_ratio: 0.1601, return_rate: 0.07, liability: 328324078},
  {fund: 'JRS', assets: 804188844, funded_ratio: 0.3475, return_rate: 0.07, liability: 2314212501},
  {fund: 'SERS', assets: 14741736065, funded_ratio: 0.3618, return_rate: 0.0725, liability: 40745539151},
  {fund: 'SURS', assets: 17104606665, funded_ratio: 0.4328, return_rate: 0.0725, liability: 39520810224},
  {fund: 'TRS', assets: 45435192645, funded_ratio: 0.42, return_rate: 0.075, liability: 108179030107}
];

function addAggregatePlan() {
  var aggregatePlan = {fund: 'Total', assets: 0, funded_ratio: 0, return_rate: 0, liability: 0}
  for(var i=0; i<pension_plans_formatted.length; i++) {
    aggregatePlan.assets += pension_plans_formatted[i].assets;
    aggregatePlan.return_rate += pension_plans_formatted[i].return_rate * pension_plans_formatted[i].assets;
    aggregatePlan.liability += pension_plans_formatted[i].liability;
  }
  aggregatePlan.return_rate = aggregatePlan.return_rate/aggregatePlan.assets;
  aggregatePlan.funded_ratio = aggregatePlan.assets/aggregatePlan.liability;
  return aggregatePlan;
};

var numericFields = ['Payroll', 'State_Contribution', 'Employee_Contribution', 'Debt_Service', 'Total', 'Assets', 'AAL']

var translateTotalsDataToPlanObjects = function(totalsData) {
    var aggregateHash = {};
    // clean data and add to aggregate hash
    for(var i=0; i<totalsData.length; i++) {
      var data = totalsData[i];
      if(!aggregateHash.hasOwnProperty(data.Year)) aggregateHash[data.Year] = {Year: data.Year};
      for(var j=0; j<numericFields.length; j++) {
        var field = numericFields[j];
        if(!data.hasOwnProperty(field)) data[field] = 0;
        data[field] = Number(data[field]);
        if(isNaN(data[field])) data[field] = 0;
        if(!aggregateHash[data.Year].hasOwnProperty(field)) aggregateHash[data.Year][field] = 0;
        aggregateHash[data.Year][field] += data[field];
      }
      aggregateHash[data.Year].FundingRatio = Math.round(aggregateHash[data.Year].Assets/aggregateHash[data.Year].AAL*100);
    }
    for (var i=0; i < pension_plans_formatted.length; i++) {
        var planRow = pension_plans_formatted[i];
        var plan = planRow.fund;
        var planData = [];
        for (var j=0; j < totalsData.length; j++) {
            var totalRow = totalsData[j];
            if (totalRow.System == plan) {
              totalRow.FundingRatio = Math.round(totalRow.Assets/totalRow.AAL*100);
              planData.push(totalRow);
            }
        }
        planData.sort(function(a,b) {return a.Year - b.Year;})
        planRow.totalsData = planData;
    }
    var aggregatePlan = addAggregatePlan();
    aggregatePlan.totalsData = [];
    for(var yr in aggregateHash) {
      aggregatePlan.totalsData.push(aggregateHash[yr]);
    }
    pension_plans_formatted.splice(0, 0, aggregatePlan);
    return pension_plans_formatted;
}

var reviseFundingRatio = function(stateContributionVsPayrollRatio, plan) {
    var totalsData = $.extend(true, [], plan.totalsData);
    for (var i=0; i< totalsData.length; i++) {
        var row = totalsData[i];
        // revise Assets for this payroll ratio
        row.State_Contribution = stateContributionVsPayrollRatio / 100 * Number(row.Payroll);
        var payments = Number(row.State_Contribution) + Number(row.Employee_Contribution);
        var netFlows = payments - Number(row.Debt_Service) - Number(row.Total)
        if (i < totalsData.length - 1 && row.Assets != '' && row.AAL != '') {
            totalsData[i+1].Assets = Number(row.Assets) * (1 + plan.return_rate) +
                netFlows * Math.pow((1 + plan.return_rate), 0.5)
        }
        //calculate FundingRatio
        row.FundingRatio = Math.round(Number(row.Assets)/Number(row.AAL)*100);
    }
    return totalsData;
}

var transformDataToGraphData = function(rows, x, y, fund, ratio) {
    // data needs to be transformed into a particular structure:
    // [{key: "GARS", values: [[x,y], [x,y], ...]}, {key: "TRS", values: [[x,y], [x,y], ...]}, ...]
    var label = ratio + '% of payroll';
    if(ratio == 'Actuarial Recommendation') label = ratio;
    var data_index = [];
    for (var i=0; i< rows.length; i++) {
        var row = rows[i];
        data_index.push([row[x], row[y]])
    }
    return {key: label, values: data_index, fund: fund, ratio: ratio};
}

buildGraph = function(data_src, plan) {
    // Wrapping in nv.addGraph allows for '0 timeout render', stores rendered charts in nv.graphs,
    // and may do more in the future... it's NOT required
    nv.addGraph(function() {
        var chart = nv.models.lineChart()
            .useInteractiveGuideline(true)
            .x(function(d) { return d[0] })
            .y(function(d) { return d[1] })
            .color(d3.scale.category10().range())
            .duration(300)
            .clipVoronoi(false);

        chart.yAxis.axisLabel("% of Liabilities Covered by Assets (Funded Ratio)");
        chart.xAxis.axisLabel("Year");
        chart.yDomain([-100, 200])

        $('#chart1').append("<h3>" + plan + ": State Contributions as Percentage of Payroll vs Funding Ratio</h3>")
        d3.select('#chart1').append("svg").attr("width", 800).attr("height", 500)
            .datum(data_src)
            .call(chart);
        //TODO: Figure out a good way to do this automatically
        nv.utils.windowResize(chart.update);
        chart.dispatch.on('stateChange', function(e) { nv.log('New State:', JSON.stringify(e)); });
        return chart;
    });
}


// runs the data processing and creates the graphData
start();
