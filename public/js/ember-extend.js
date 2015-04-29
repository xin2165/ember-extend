DS.BeangleAdapter = DS.RESTAdapter.extend({
  //append '.json' to buildURL
  buildURL : function(typeKey, id, record){
    return this._super(typeKey, id, record) + '.json';
  },
  //add typeKey to options
  find: function(store, type, id, record) {
    return this.ajax(this.buildURL(type.typeKey, id, record), 'GET', {typeKey: type.typeKey});
  },
  ajax: function(url, type, options) {
    var adapter = this;
    return new Ember.RSVP.Promise(function(resolve, reject) {
      var hash = adapter.ajaxOptions(url, type, options);
      hash.success = function(json, textStatus, jqXHR) {
        json = adapter.ajaxSuccess(jqXHR, json);
        //fixed typeKey for json
        var data = {};
        data[options.typeKey] = json;
        json = data;
        if (json instanceof DS.InvalidError) {
          Ember.run(null, reject, json);
        } else {
          // console.log(json);
          Ember.run(null, resolve, json);
        }
      };
      hash.error = function(jqXHR, textStatus, errorThrown) {
        Ember.run(null, reject, adapter.ajaxError(jqXHR, jqXHR.responseText, errorThrown));
      };
      Ember.$.ajax(hash);
    }, 'DS: RESTAdapter#ajax ' + type + ' to ' + url);
  }
});
Ember.Store = Ember.Object.extend({
	host : 'http://192.168.103.24:8080/edu-base-ws/default/',
	route: null,
	entityName : function(){
		return this.get('route').get('entityName');
	}.property('route'),
	find : function(a, b){
    // console.log('Store.find', this.get('route').controller);
    if(typeof(a) != 'object'){
      return this.findById(a, b);
    }
    var url = this.getUrl();
    var opts = a, route = this.route, controller = route.controller;
    if(controller){
      var searchField = Ember.getParamObject(controller.get('searchField'));
      Ember.$.extend(opts, searchField);
    }
		if(route.select) opts.select = route.select;
		return Ember.$.getJSON(url, opts).then(function(data){
      if(typeof(b) == 'function'){
        b(data);
      }
      route.set('data', data);
			return data.items;
		});
	},
  getUrl : function (id){
    var name = this.get('entityName'), route = this.get('route'), url = route.url;
    if(url){
    }else{
      url = this.get('host') + name;
    }
    if(id){
      url += "/" + id;
    }
    url += '.json';
    return url;
  },
	findById : function(id, opts){
		var url = this.getUrl(id);
		return Ember.$.getJSON(url);
	},

	save : function(model){
		var url = this.getUrl(model.id);
    if(model.id){
      url += '?_method=PUT';
    }else{
      url += '?_method=POST';
    }
    return Ember.$.post(url, {'data': JSON.stringify(model)});
	},
  remove : function (ids){
    var url = this.getUrl();
    url += '?_method=DELETE';
    return Ember.$.post(url, {'ids': ids.join(',')});
  },
  getFormParams : function(model, data, perfix){
    data = data || {}, perfix = perfix || this.get('route').controller.get('shortName') + '.';
    for(name in model){
      if(model.hasOwnProperty(name)){
        var value = model[name];
        if(typeof(value) == 'object'){
          this.getBeangleParams(value, data, perfix + name + '.');
        }else{
          data[perfix + name] = value;
        }
      }
    }
    return data;
  }
});

Ember.EntityRoute = Ember.Route.extend({
	beforeModel : function(){
		this.store = Ember.Store.create({route: this});
	},
	setupController : function(controller, model){
		controller.set('store', this.get('store'));
    controller.route = this;
		//调用父类方法
		this._super(controller, model);
	},
  getParentRouteName : function (){
    return this.get('routeName').substring(0, this.get('routeName').indexOf('.'));
  },
  getIndexRouteName : function(){
    return this.getParentRouteName() + '.index';
  },
  getInfoRouteName : function(){
    return this.getParentRouteName() + '.info';
  },
  getEditRouteName : function(){
    return this.getParentRouteName() + '.edit';
  },
	model : function (params){
    if(params && params.id){
      return this.store.find(params.id);
    }else{
      return {};
    }
	}
});

Ember.EntityAddRoute = Ember.EntityRoute.extend({
  // renderTemplate: function() {
  //   this.render(this.getParentRouteName() + '/edit');
  // },
  // setupController : function(controller, model){
  //   this.controllerFor(this.getEditRouteName()).set('model', {});
  //   this._super(controller, model);
  // }
  model : function (){
    return {};
  }
});
Ember.PageRoute = Ember.EntityRoute.extend({
	setupController: function(controller, model) {
    if(controller.pageIndex){
      controller.setData(this.get('data'));
    }
    this._super(controller, model);
  },
  model : function(params){
    // console.log('PageRoute model', params);
    return this.store.find(params);
  }
});

Ember.EntityController = Ember.ObjectController.extend({
  actions : {
    save : function(){
      var model = this.model;
      var controller = this;
      this.store.save(model).then(function(data){
        if(data.status == 'error'){
          alert('保存失败');
        }else{
          controller.transitionToRoute(controller.store.route.getInfoRouteName(), model);
        }
      }, function(){
        alert('保存失败');
      });
    }
  }
});

Ember.PageController = Ember.ArrayController.extend({
  routeName:'',
  searchField: {},
	pageIndex: 1,
	isSelectAll: false,
  setData : function(data){
    // console.log('setData');
    this.set('pageIndex', data.pageIndex);
    this.set('pageSize', data.pageSize);
    this.set('totalItems', data.totalItems);
    this.set('model', data.items);
  },
  routeName:function (){
    return this.get('route').routeName;
  }.property('pageIndex'),
	pageLast: function(){
		return Math.ceil(this.totalItems * 1.0 / this.pageSize);
	}.property('pageSize', 'totalItems'),
	isPageFirst: function(){
		return this.pageIndex == 1;
	}.property('pageIndex'),
	pagePrev: function(){
		return this.pageIndex == 1 ? 1 : this.pageIndex - 1;
	}.property('pageIndex'),
	pageNext: function(){
		return this.get('pageLast') == this.pageIndex ? this.pageIndex : this.pageIndex + 1;
	}.property('pageIndex'),
	isPageLast: function(){
		// console.log('isPageLast',this.get('pageLast'), this.pageIndex)
		return this.get('pageLast') == this.pageIndex;
	}.property('pageLast', 'pageIndex'),
	pageIndexs : function(){
		var list = [];
		var start = this.pageIndex - 2, end = this.pageIndex + 2;
		var index = this.pageIndex;		
		for(var i = start; i <= this.get('pageLast') && list.length < 5; i++){
			if(i > 0){
				list.push(i);
			}
		}
		// console.log(list)
		return list;
	}.property('pageIndex','pageSize','totalItems'),
  allAreSelect: function (key, value) {
  	// console.log('allAreSelect', key, value);
    if (arguments.length === 2) {
      this.setEach('isSelect', value);
      return value;
    }else{
    	var value = true;
    	this.forEach(function(m){
    		value = value && m.isSelect;
    	});
    	return value;
    }
  }.property('@each.isSelect'),
  isSelectOne : function(){
  	return this.get('selectNum') == 1;
  }.property('selectNum'),
  isSelect : function(){
  	return this.get('selectNum') > 0;
  }.property('selectNum'),
  selectNum : function(){
		var num = 0;
  	this.forEach(function(m){
  		if(m.isSelect) num ++;
  	});
  	return num;
  }.property('@each.isSelect'),
  getTopRoute : function(){
    return this.get('routeName').substring(0, this.get('routeName').indexOf('.'));
  },
  selectedId : function(){
    console.log('selectedId');
    var id = null;
    this.forEach(function(m){
      if(m.isSelect) {
        id = m.id;
      }
    });
    return id;
  }.property('@each.isSelect'),
  selectedIds : function(){
    console.log('selectedId');
    var ids = [];
    this.forEach(function(m){
      if(m.isSelect) {
        ids.push(m.id);
      }
    });
    return ids;
  }.property('@each.isSelect'),
	actions :{
		selectAll : function(){
			var isSelect = this.isSelectAll = !this.isSelectAll;
			this.get('model').forEach(function(m){
				m.isSelect = isSelect;
			});
		},
    add : function(){
      this.transitionToRoute(this.getTopRoute() + '.add');
    },
    edit : function (){
      console.log(this.get('selectedId'));
      this.transitionToRoute(this.getTopRoute() + '.edit', this.get('selectedId'));
    },
    remove : function(){
      var ctl = this;
      this.store.remove(this.get('selectedIds')).then(function(data){
        if(data.status == 'error'){
          alert('删除失败');
        }else{
          // ctl._actions.search.call(ctl);
          ctl.send('search');
        }
      }, function(){
        alert('删除失败');
      });
    },
    search : function(){
      if(this.get('pageIndex') != 1){
        this.transitionToRoute(this.get('routeName'), 1, this.get('pageSize'));
      }else{
        var ctl = this;
        this.store.find({pageIndex:1, pageSize: this.get('pageSize')}, function(data){
          ctl.setData(data);
        });
      }
    }
	}
});

Ember.Handlebars.helper('if-equals2', function(v1, v2, options) {
  console.log('ifEquals', v1, v2, v1 == v2);
  // reutrn options.fn(this);
});

Ember.LinkView.reopen({
  attributeBindings : ['aria-label']
});

Ember.getParamObject = function (obj){
  var newObj = {};
  for(name in obj){
    if(!obj.hasOwnProperty(name)) continue; 
    newObj[Ember.getDotName(name)] = obj[name];
  }
  return newObj;
}
Ember.getDotName = function(name){
  var reg = /([A-Z])\1/;
  var arr;
  while((arr = reg.exec(name)) != null){
    name = name.replace(arr[0], '.' + arr[1].toLowerCase());
  }
  return name;
}

//md5
function hex_md5(s){
  var hexcase = 0;
  var chrsz   = 8;  /* bits per input character. 8 - ASCII; 16 - Unicode      */
  function str2binl(str){
    var bin = Array();
    var mask = (1 << chrsz) - 1;
    for(var i = 0; i < str.length * chrsz; i += chrsz)
      bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (i%32);
    return bin;
  }
  function core_md5(x, len){
    /* append padding */
    x[len >> 5] |= 0x80 << ((len) % 32);
    x[(((len + 64) >>> 9) << 4) + 14] = len;

    var a =  1732584193;
    var b = -271733879;
    var c = -1732584194;
    var d =  271733878;

    for(var i = 0; i < x.length; i += 16)
    {
      var olda = a;
      var oldb = b;
      var oldc = c;
      var oldd = d;

      a = md5_ff(a, b, c, d, x[i+ 0], 7 , -680876936);
      d = md5_ff(d, a, b, c, x[i+ 1], 12, -389564586);
      c = md5_ff(c, d, a, b, x[i+ 2], 17,  606105819);
      b = md5_ff(b, c, d, a, x[i+ 3], 22, -1044525330);
      a = md5_ff(a, b, c, d, x[i+ 4], 7 , -176418897);
      d = md5_ff(d, a, b, c, x[i+ 5], 12,  1200080426);
      c = md5_ff(c, d, a, b, x[i+ 6], 17, -1473231341);
      b = md5_ff(b, c, d, a, x[i+ 7], 22, -45705983);
      a = md5_ff(a, b, c, d, x[i+ 8], 7 ,  1770035416);
      d = md5_ff(d, a, b, c, x[i+ 9], 12, -1958414417);
      c = md5_ff(c, d, a, b, x[i+10], 17, -42063);
      b = md5_ff(b, c, d, a, x[i+11], 22, -1990404162);
      a = md5_ff(a, b, c, d, x[i+12], 7 ,  1804603682);
      d = md5_ff(d, a, b, c, x[i+13], 12, -40341101);
      c = md5_ff(c, d, a, b, x[i+14], 17, -1502002290);
      b = md5_ff(b, c, d, a, x[i+15], 22,  1236535329);

      a = md5_gg(a, b, c, d, x[i+ 1], 5 , -165796510);
      d = md5_gg(d, a, b, c, x[i+ 6], 9 , -1069501632);
      c = md5_gg(c, d, a, b, x[i+11], 14,  643717713);
      b = md5_gg(b, c, d, a, x[i+ 0], 20, -373897302);
      a = md5_gg(a, b, c, d, x[i+ 5], 5 , -701558691);
      d = md5_gg(d, a, b, c, x[i+10], 9 ,  38016083);
      c = md5_gg(c, d, a, b, x[i+15], 14, -660478335);
      b = md5_gg(b, c, d, a, x[i+ 4], 20, -405537848);
      a = md5_gg(a, b, c, d, x[i+ 9], 5 ,  568446438);
      d = md5_gg(d, a, b, c, x[i+14], 9 , -1019803690);
      c = md5_gg(c, d, a, b, x[i+ 3], 14, -187363961);
      b = md5_gg(b, c, d, a, x[i+ 8], 20,  1163531501);
      a = md5_gg(a, b, c, d, x[i+13], 5 , -1444681467);
      d = md5_gg(d, a, b, c, x[i+ 2], 9 , -51403784);
      c = md5_gg(c, d, a, b, x[i+ 7], 14,  1735328473);
      b = md5_gg(b, c, d, a, x[i+12], 20, -1926607734);

      a = md5_hh(a, b, c, d, x[i+ 5], 4 , -378558);
      d = md5_hh(d, a, b, c, x[i+ 8], 11, -2022574463);
      c = md5_hh(c, d, a, b, x[i+11], 16,  1839030562);
      b = md5_hh(b, c, d, a, x[i+14], 23, -35309556);
      a = md5_hh(a, b, c, d, x[i+ 1], 4 , -1530992060);
      d = md5_hh(d, a, b, c, x[i+ 4], 11,  1272893353);
      c = md5_hh(c, d, a, b, x[i+ 7], 16, -155497632);
      b = md5_hh(b, c, d, a, x[i+10], 23, -1094730640);
      a = md5_hh(a, b, c, d, x[i+13], 4 ,  681279174);
      d = md5_hh(d, a, b, c, x[i+ 0], 11, -358537222);
      c = md5_hh(c, d, a, b, x[i+ 3], 16, -722521979);
      b = md5_hh(b, c, d, a, x[i+ 6], 23,  76029189);
      a = md5_hh(a, b, c, d, x[i+ 9], 4 , -640364487);
      d = md5_hh(d, a, b, c, x[i+12], 11, -421815835);
      c = md5_hh(c, d, a, b, x[i+15], 16,  530742520);
      b = md5_hh(b, c, d, a, x[i+ 2], 23, -995338651);

      a = md5_ii(a, b, c, d, x[i+ 0], 6 , -198630844);
      d = md5_ii(d, a, b, c, x[i+ 7], 10,  1126891415);
      c = md5_ii(c, d, a, b, x[i+14], 15, -1416354905);
      b = md5_ii(b, c, d, a, x[i+ 5], 21, -57434055);
      a = md5_ii(a, b, c, d, x[i+12], 6 ,  1700485571);
      d = md5_ii(d, a, b, c, x[i+ 3], 10, -1894986606);
      c = md5_ii(c, d, a, b, x[i+10], 15, -1051523);
      b = md5_ii(b, c, d, a, x[i+ 1], 21, -2054922799);
      a = md5_ii(a, b, c, d, x[i+ 8], 6 ,  1873313359);
      d = md5_ii(d, a, b, c, x[i+15], 10, -30611744);
      c = md5_ii(c, d, a, b, x[i+ 6], 15, -1560198380);
      b = md5_ii(b, c, d, a, x[i+13], 21,  1309151649);
      a = md5_ii(a, b, c, d, x[i+ 4], 6 , -145523070);
      d = md5_ii(d, a, b, c, x[i+11], 10, -1120210379);
      c = md5_ii(c, d, a, b, x[i+ 2], 15,  718787259);
      b = md5_ii(b, c, d, a, x[i+ 9], 21, -343485551);

      a = safe_add(a, olda);
      b = safe_add(b, oldb);
      c = safe_add(c, oldc);
      d = safe_add(d, oldd);
    }
    return Array(a, b, c, d);
  }
  function binl2hex(binarray){
    var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
    var str = "";
    for(var i = 0; i < binarray.length * 4; i++){
      str += hex_tab.charAt((binarray[i>>2] >> ((i%4)*8+4)) & 0xF) +
       hex_tab.charAt((binarray[i>>2] >> ((i%4)*8  )) & 0xF);
    }
    return str;
  }
  function md5_ff(a, b, c, d, x, s, t){
    return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
  } 
  function md5_gg(a, b, c, d, x, s, t){
    return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
  }
  function md5_hh(a, b, c, d, x, s, t){
    return md5_cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function md5_ii(a, b, c, d, x, s, t){
    return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
  }
  function md5_cmn(q, a, b, x, s, t){
    return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s),b);
  }  
  function safe_add(x, y){
    var lsw = (x & 0xFFFF) + (y & 0xFFFF);
    var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  } 
  function bit_rol(num, cnt){
    return (num << cnt) | (num >>> (32 - cnt));
  }
  return binl2hex(core_md5(str2binl(s), s.length * chrsz));
}