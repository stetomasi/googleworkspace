var CLIENT_ID = '<your-facebook-app-client-id>';
var CLIENT_SECRET = '<your-facebook-app-client-secret>'; 

function runReport(startDate, endDate, accountId, requestedFieldIds){
  var fbFields = []
  
  Logger.log(JSON.stringify(requestedFieldIds));
  
  for(var i=0; i < requestedFieldIds.length; i++){
      switch (requestedFieldIds[i]) {
          case 'campaign':
            fbFields.push("campaign_name");
            break;
          case 'impressions':
            fbFields.push("impressions");
            break;
          case 'clicks':
            fbFields.push("clicks");
            break;
          case 'spend':
            fbFields.push("spend");
            break;
          case 'transactions':
            fbFields.push("actions");
            break;
          case 'revenue':
            fbFields.push("action_values");
            break;
          case 'adset':
            fbFields.push("adset_name");
            break;
          case 'ad':
            fbFields.push("ad_name");
            break;
      }
  }
  
  //Logger.log(JSON.stringify(fbFields));
  
  var requestEndpoint = "https://graph.facebook.com/v8.0/act_" + accountId + "/insights/?"
  
  var timeRange = "{'since':'" + startDate + "', 'until':'" + endDate + "'}";

  var requestUrl = requestEndpoint + "time_increment=1";
  
  requestUrl += "&limit=100000";
  requestUrl += "&level=ad";
  requestUrl += "&fields=" + fbFields.join(",");
  requestUrl += "&time_range=" + encodeURIComponent(timeRange);
  requestUrl += "&access_token=" + getOAuthService().getAccessToken()

  //Logger.log(requestUrl);
  
  var response = UrlFetchApp.fetch(requestUrl);
  var parseData = JSON.parse(response);    
 
  return parseData;  
}

function getDataForDateRange(startDate, endDate, accountId, requestedFieldIds){   
  var currentStartDate = startDate;
  var reportData = [];
    
  do {    
    var currentEndDate = (addDays(currentStartDate, 7) > endDate) ? endDate : addDays(currentStartDate, 7);        
    
    var currentStartDateString = currentStartDate.toISOString().substring(0, 10);
    var currentEndDateString = currentEndDate.toISOString().substring(0, 10);
    
    //Logger.log("Start=" + currentStartDateString + " End=" + currentEndDateString);
    
    var currentReport = runReport(currentStartDateString, currentEndDateString, accountId, requestedFieldIds);
    
    reportData = reportData.concat(currentReport['data']);
    
    currentStartDate = currentEndDate;
  } while( currentStartDate != endDate );  
  
  return reportData;
} 

function getConfig() {
  var cc = DataStudioApp.createCommunityConnector();
  var config = cc.getConfig();

  config.newInfo()
      .setId('instructions')
      .setText('Please enter the configuration data for your Facebook connector');

  config.newTextInput()
      .setId('ads_account_id')
      .setName('Enter your Facebook Ads Account Id')
      .setHelpText('')  
      .setPlaceholder('1046444455411879')
      .setAllowOverride(false);
  
  config.setDateRangeRequired(true);

  return config.build();
}

function getFields() {
  var cc = DataStudioApp.createCommunityConnector();
  var fields = cc.getFields();
  var types = cc.FieldType;
  var aggregations = cc.AggregationType;  
  
  fields.newDimension()
      .setId('date')
      .setName('Date')
      .setType(types.YEAR_MONTH_DAY);
  
  fields.newDimension()
      .setId('campaign')
      .setName('Campaign')
      .setType(types.TEXT);  

  fields.newDimension()
      .setId('adset')
      .setName('Adset')
      .setType(types.TEXT);    

  fields.newDimension()
      .setId('ad')
      .setName('Ad')
      .setType(types.TEXT);  
  
  fields.newMetric()
      .setId('impressions')
      .setName('Impressions')
      .setType(types.NUMBER)
      .setAggregation(aggregations.SUM);
  
  fields.newMetric()
      .setId('clicks')
      .setName('Clicks')
      .setType(types.NUMBER)
      .setAggregation(aggregations.SUM);

  fields.newMetric()
      .setId('spend')
      .setName('Spend')
      .setType(types.CURRENCY_EUR)
      .setAggregation(aggregations.SUM);

  fields.newMetric()
      .setId('transactions')
      .setName('Transactions')
      .setType(types.NUMBER)
      .setAggregation(aggregations.SUM);

  fields.newMetric()
      .setId('revenue')
      .setName('Revenue')
      .setType(types.CURRENCY_EUR)
      .setAggregation(aggregations.SUM);
    
  return fields;
}


function getSchema(request) {  
    var fields = getFields().build();
    return { 'schema': fields };    
}


function getData(request) {     
  var requestedFieldIds = request.fields.map(function(field) {
    return field.name;
  });
  
  var requestedFields = getFields().forIds(requestedFieldIds);    
  
  var startDate = new Date(request['dateRange'].startDate);
  var endDate = new Date(request['dateRange'].endDate);

  var adsAccountId = request.configParams['ads_account_id'];
  
  var reportData = getDataForDateRange(startDate, endDate, adsAccountId, requestedFieldIds)   
  Logger.log(JSON.stringify(reportData));
  var rows = reportToRows(requestedFields, reportData);
  
  
  result = {
    schema: requestedFields.build(),
    rows: rows
  };   
  
  return result;  
}


function reportToRows(requestedFields, report) {  
  rows = [];
  
  for( var i = 0; i < report.length; i++){
    var row = [];
    
    var campaign = report[i]['campaign_name'];
    var adset = report[i]['adset_name'];
    var ad = report[i]['ad_name'];
    var impressions = report[i]['impressions'];
    var spend = report[i]['spend'];
    var clicks = report[i]['clicks'];
    var date = report[i]['date_start'];
    
    var transactions = 0;
    var revenue = 0;
        
    if( 'actions' in report[i] ){    
      for(var j = 0; j < report[i]['actions'].length; j++ ){        
          transactions += report[i]['actions'][j]['value'];
      }
    }

    if( 'action_values' in report[i] ){    
      for(var j = 0; j < report[i]['action_values'].length; j++ ){        
          revenue += report[i]['action_values'][j]['value'];
      }
    }
        
    requestedFields.asArray().forEach(function (field) {
      switch (field.getId()) {
          case 'date':
            return row.push(date.replace(/-/g,''));
          case 'campaign':
            return row.push(campaign);
          case 'impressions':
            return row.push(impressions);
          case 'clicks':
            return row.push(clicks);
          case 'spend':
            return row.push(spend);
          case 'transactions':
            return row.push(transactions);
          case 'revenue':
            return row.push(revenue);
          case 'adset':
            return row.push(adset);
          case 'ad':
            return row.push(ad);
      }
    });
    
    rows.push({ values: row });
  }
  
  return rows;
}          


function isAdminUser(){
 var email = Session.getEffectiveUser().getEmail();
  if( email == 'bjoern.stickler@reprisedigital.com' ){
    return true; 
  } else {
    return false;
  }
}

/**** BEGIN: OAuth Methods ****/

function getAuthType() {
  var response = { type: 'OAUTH2' };
  return response;
}

function resetAuth() {
  getOAuthService().reset();
}

function isAuthValid() {
  return getOAuthService().hasAccess();
}

function getOAuthService() {
  return OAuth2.createService('exampleService')
    .setAuthorizationBaseUrl('https://www.facebook.com/dialog/oauth')
    .setTokenUrl('https://graph.facebook.com/v3.1/oauth/access_token')      
    .setClientId(CLIENT_ID)
    .setClientSecret(CLIENT_SECRET)
    .setPropertyStore(PropertiesService.getUserProperties())
    .setCallbackFunction('authCallback')
    .setScope('ads_read');
};

function authCallback(request) {
  var authorized = getOAuthService().handleCallback(request);
  if (authorized) {
    return HtmlService.createHtmlOutput('Success! You can close this tab.');
  } else {
    return HtmlService.createHtmlOutput('Denied. You can close this tab');
  };
};

function get3PAuthorizationUrls() {
  return getOAuthService().getAuthorizationUrl();
}

/**** END: OAuth Methods ****/

/**** BEGIN: Other Methods ****/

function addDays(date, days) {
  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
