var xmlns="http://www.w3.org/2000/svg", select = function(s) {
      return document.querySelector(s);
    }, selectAll = function(s) {
      return document.querySelectorAll(s);
    }, bread = select('.bread'), handle = select('.handle'), ticker = select('.ticker'), light = select('.light'), lightGlow = select('.lightGlow'), wholeToaster = select('.wholeToaster'), circleBg = select('.circleBg'),
arrow = select('.arrow'), 
pull = select('.pull'), 
heatLinesGroup = selectAll('.heatLinesGroup path'), 
helloLinesGroup = select('.helloLinesGroup')


//SET UP
TweenMax.set(bread, {
  y:-30
})
TweenMax.set(helloLinesGroup, {
  transformOrigin:'50% 50%',
  scale:0,
  alpha:0
})
TweenMax.set([pull], {
  alpha:0
 
})
TweenMax.set([arrow], {
  alpha:0,
  y:-5
})

TweenMax.set(wholeToaster, {
  transformOrigin:'50% 50%',
  scale:0
})

TweenMax.set(heatLinesGroup, {
  drawSVG:'100% 100%'
})



//INTRO TIMELINE
var introTl = new TimelineMax({delay:0.65});
introTl.to(circleBg, 1, {
  attr:{
    r:240
  },
  ease:Power3.easeInOut
})
.to(wholeToaster, 1, {
  scale:1,
  ease:Power3.easeInOut
},'-=0.8')
.to(helloLinesGroup, 2, {
  scale:1.4,
  alpha:1,
  ease:Expo.easeOut
},'-=0.45')

introTl.timeScale(1)

//LIGHT FLASH ANIMATION
var glowTl = new TimelineMax({repeat:4, paused:true});
glowTl.to(lightGlow, 1,{
  attr:{
    r:16
  },
  alpha:0
})

//HEAT LINES WHEN BREAD IS TOASTING
var heatLinesTl = new TimelineMax({repeat:2, paused:true, repeatDelay:0.5});
heatLinesTl.to(heatLinesGroup, 1, {
  drawSVG:'0% 50%',
  ease:Linear.easeNone
})
.to(heatLinesGroup, 1, {
  drawSVG:'0% 0%',
  ease:Linear.easeNone
})
.to(heatLinesGroup, 2, {
  y:20,
  ease:Power2.easeIn,
},'-=2')
heatLinesTl.timeScale(1.4);


//ARROW

var arrowTl = new TimelineMax({paused:true});
arrowTl.to(pull, 0.8, {
  alpha:1
})
.to(arrow, 1.2, {
  y:'+=20',
  alpha:1,
  ease:Power4.easeInOut,
  repeat:2
})
.to([arrow, pull], 1, {
  alpha:0,
  delay:1
})


//MAIN TIMELINE
var tl = new TimelineMax({repeat:0, repeatDelay:1, paused:true, onComplete:resetBreadColour});
tl.set(light, {
  fill:'#F04302'
})
.to([handle, bread], 0.2, {
  y:'-=4'
})

.to(ticker, 8, {
  rotation:150,
  ease:Linear.easeNone,
  transformOrigin:'85% 50%'
})
.to(bread, 8, {
  fill:'#95623C',
  stroke:'#B98861',
  ease:Linear.easeNone
},'-=8')
.set(light, {
  fill:'#7f7f7f'
})
/*
.to(bread, 0.03, {
  y:3
})
*/
.to(bread, 0.8, {
  y:-190,
  ease:Power3.easeOut
})
.to(handle, 0.2,{
  y:0,
  ease:Back.easeOut
},'-=0.8')

.to(ticker, 0.2,{
  rotation:0
},'-=0.8')

.to(bread, 1.2,{
  rotation:-360,
  transformOrigin:'50% 50%',
  ease:Linear.easeNone
},'-=0.6')
.to(bread, 0.7,{
  y:-20,
  ease:Power2.easeIn
},'-=0.6')
.to(handle, 0.2,{
  y:4,
  ease:Power2.easeIn
},'-=0.2')
.to(bread, 0.3,{
  y:-30
})
.to(handle, 0.3,{
  y:0
},'-=0.3')

tl.timeScale(1.6)


var handleDragger = Draggable.create(handle, {
  type:'y',
  bounds:{minY:0, maxY:30},
  onDrag:lowerBread,
  onPress:resetBreadColour,
  onRelease:checkHandle
})

function lowerBread(){
  
  TweenMax.set(bread, {
    y:handle._gsTransform.y - 30
  })

}

function resetBreadColour(){  
  TweenMax.to(bread, 1, {
    fill:'#DDB494',
    stroke:'#CBA276',
    delay:2,
    onComplete:function(){
      handleDragger[0].enable();
    }
    
  })
  
  TweenMax.killDelayedCallsTo(showInfo);
}

function checkHandle(){
  
  if(handle._gsTransform.y >= 30){
    tl.play(0);
    glowTl.play(0);
    heatLinesTl.play(0);
    handleDragger[0].disable();
    
  } else{
    
    TweenMax.to(bread, 0.3,{
      y:-30,
      ease:Back.easeOut
     });
    TweenMax.to(handle, 0.3,{
      y:0,
      ease:Back.easeOut
     });
    
  }  
  
}

function showInfo(){
  
  arrowTl.play(0);
  
  TweenMax.delayedCall(12, showInfo);
}

TweenMax.delayedCall(4, showInfo);

TweenMax.set('svg', {
  visibility:'visible'
})