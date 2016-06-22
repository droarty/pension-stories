var RATE_OF_RETURN = 0.725

var start = function() {
  // pull in all the participant data from the csv
  d3.csv('../data_src/all_pensions_data.csv')
      .get(function(error, rows) {  //callback after loading
          var planData = translateTotalsDataToPlanObjects(rows)
          var contributionPayrollRatios = [0.1, 0.2, 0.3, 0.4, 0.5]
          for (var j=0;  j < planData.length; j++) {
              var planRow = planData[j];
              var graphData = [];
              for (var i=0; i < contributionPayrollRatios.length; i++) {
                  var ratio = contributionPayrollRatios[i];
                  var revisedData = reviseFundingRatio(ratio, planRow)
                  graphData.push(transformDataToGraphData(revisedData, 'Year', 'FundingRatio', ratio))
              }
              buildGraph(graphData)
          }
      });
}

/*  example record:
{AAL: "328.00", AllInactives: "23.07", Assets: "65.69", Beneficiaries: "21.03", Debt_Service: "3.39", Employee_Contribution: "1.34", FutureTier2: "0.23", Inactives: "2.04", Payroll: "11.63", State_Contribution: "22.46", System: "GARS", Tier1: "5.00", Tier2: "0.22", Total: "28.52", Year: "2026"}
*/

var pension_plans_formatted = [
  {fund: 'GARS', assets: '52564685', funded_ratio: 0.1601, return_rate: 0.07, liability: 328324078},
  {fund: 'JRS', assets: '804188844', funded_ratio: 0.3475, return_rate: 0.07, liability: 2314212501},
  {fund: 'SERS', assets: '14741736065', funded_ratio: 0.3618, return_rate: 0.0725, liability: 40745539151},
  {fund: 'SURS', assets: '17104606665', funded_ratio: 0.4328, return_rate: 0.0725, liability: 39520810224},
  {fund: 'TRS', assets: '45435192645', funded_ratio: 0.42, return_rate: 0.075, liability: 108179030107}
];

var translateTotalsDataToPlanObjects = function(totalsData) {
    for (var i=0; i < pension_plans_formatted.length; i++) {
        var planRow = pension_plans_formatted[i];
        var plan = planRow.fund;
        var planData = [];
        for (var j=0; j < totalsData.length; j++) {
            var totalRow = totalsData[j];
            if (totalRow.System == plan) planData.push(totalRow);
        }
        planData.sort(function(a,b) {return a.Year - b.Year;})
        planRow.totalsData = planData;
    }
    return pension_plans_formatted;
}

var reviseFundingRatio = function(stateContributionVsPayrollRatio, plan) {
    var totalsData = plan.totalsData;
    for (var i=0; i< totalsData.length; i++) {
        var row = totalsData[i];
        row.State_Contribution = stateContributionVsPayrollRatio * Number(row.Payroll);
        var payments = Number(row.State_Contribution) + Number(row.Employee_Contribution);
        var netFlows = payments - Number(row.Debt_Service) - Number(row.Total)
        if (i < totalsData.length - 1) {
            totalsData[i+1].Assets = Number(row.Assets) * (1 + plan.return_rate) +
                payments * Math.pow((1 + plan.return_rate), 0.5)
        }
        row.FundingRatio = Math.round(Number(row.Assets)/Number(row.AAL)*1000)/1000;
    }
    return totalsData;
}

var transformDataToGraphData = function(rows, x, y, label) {
    // data needs to be transformed into a particular structure:
    // [{key: "GARS", values: [[x,y], [x,y], ...]}, {key: "TRS", values: [[x,y], [x,y], ...]}, ...]
    var data_index = [];
    for (var i=0; i< rows.length; i++) {
        var row = rows[i];
        data_index.push([row[x], row[y]])
    }
    return {key: label, values: data_index};
}

buildGraph = function(data_src) {
    // Wrapping in nv.addGraph allows for '0 timeout render', stores rendered charts in nv.graphs,
    // and may do more in the future... it's NOT required
    nv.addGraph(function() {
        var chart = nv.models.cumulativeLineChart()
            .useInteractiveGuideline(true)
            .x(function(d) { return d[0] })
            .y(function(d) { return d[1] })
            .color(d3.scale.category10().range())
            .average(function(d) { return d.mean; })
            .duration(300)
            .clipVoronoi(false);
        chart.dispatch.on('renderEnd', function() {
            console.log('render complete: cumulative line with guide line');
        });
/*            chart.xAxis.tickFormat(function(d) {
            return d3.time.format('%m/%d/%y')(new Date(d))
        });
        chart.yAxis.tickFormat(d3.format(',.1%'));
        */
        d3.select('#chart1 svg')
            .datum(data_src)
            .call(chart);
        //TODO: Figure out a good way to do this automatically
        nv.utils.windowResize(chart.update);
        chart.dispatch.on('stateChange', function(e) { nv.log('New State:', JSON.stringify(e)); });
        chart.state.dispatch.on('change', function(state){
            nv.log('state', JSON.stringify(state));
        });
        return chart;
    });
}
