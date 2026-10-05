/* Family sync: Google sign-in + one shared Firestore document (family/main).
   Signed out → the planner still works, saved only in this browser. */
const FB_CONFIG = {
  apiKey: "AIzaSyDpUWTFOOpKMTz0MdsJe3egUoAaXqZxvGk",
  authDomain: "meal-planner-a5854.firebaseapp.com",
  projectId: "meal-planner-a5854",
  storageBucket: "meal-planner-a5854.firebasestorage.app",
  messagingSenderId: "540151746455",
  appId: "1:540151746455:web:c12195cca96cd6de00fed2"
};

const Sync = {
  status:'local',          // local | connecting | synced | saving | offline | denied | error
  user:null, person:null,
  _auth:null, _doc:null, _unsub:null, _timer:null, _first:true,
  listeners:[],
  onChange(fn){ this.listeners.push(fn); },
  _emit(){ this.listeners.forEach(fn=>{ try{ fn(this); }catch(e){ console.error(e); } }); },
  _set(s){ this.status=s; this._emit(); },

  init(){
    if(!window.firebase){ this._set('local'); return; }
    try{
      firebase.initializeApp(FB_CONFIG);
      this._auth=firebase.auth();
      this._doc=firebase.firestore().doc('family/main');
    }catch(e){ console.error(e); this._set('error'); return; }
    this._auth.getRedirectResult().catch(e=>{ if(e && e.code) toast(signInError(e)); });
    this._auth.onAuthStateChanged(u=>this._onUser(u));
    window.addEventListener('online', ()=>{ if(this.user && this.status==='offline') this._set('synced'); });
    window.addEventListener('offline',()=>{ if(this.user) this._set('offline'); });
  },

  _onUser(u){
    if(this._unsub){ this._unsub(); this._unsub=null; }
    this.user=u; this.person=u?personByEmail(u.email):null;
    if(!u){ this._set('local'); return; }
    if(!this.person){ this._set('denied'); return; }
    this._first=true; this._set('connecting');
    this._unsub=this._doc.onSnapshot(snap=>{
      if(snap.metadata.hasPendingWrites) return;
      if(!snap.exists){ this._push(true); return; }          // first sign-in ever: upload this phone's plan
      const remote=snap.data();
      if(this._first || (remote.updatedAt||0) > (state.updatedAt||0)){
        replaceState(remote); renderEverything();
      }
      this._first=false;
      this._set(navigator.onLine===false?'offline':'synced');
    }, err=>{ console.error(err); this._set(err.code==='permission-denied'?'denied':'error'); });
  },

  push(){ if(!this.user||!this.person||this.status==='denied') return; clearTimeout(this._timer); this._set('saving'); this._timer=setTimeout(()=>this._push(),600); },
  _push(){
    const data=JSON.parse(JSON.stringify(state));             // strips undefined (Firestore rejects it)
    data.updatedBy=this.person?this.person.key:null;
    this._doc.set(data).then(()=>{ this._first=false; this._set('synced'); })
      .catch(err=>{ console.error(err); this._set(err.code==='permission-denied'?'denied':'error'); });
  },

  signIn(){
    if(!this._auth){ toast('Sign-in is unavailable offline'); return; }
    const provider=new firebase.auth.GoogleAuthProvider(); provider.setCustomParameters({prompt:'select_account'});
    this._auth.signInWithPopup(provider).catch(e=>{
      if(e.code==='auth/popup-blocked'||e.code==='auth/operation-not-supported-in-this-environment') return this._auth.signInWithRedirect(provider);
      if(e.code!=='auth/popup-closed-by-user'&&e.code!=='auth/cancelled-popup-request') toast(signInError(e));
    });
  },
  signOut(){ if(this._auth) this._auth.signOut().then(()=>toast('Signed out — changes now save on this phone only')); },
};
function signInError(e){
  if(e.code==='auth/unauthorized-domain') return 'This web address isn’t allowed for sign-in yet';
  if(e.code==='auth/network-request-failed') return 'No connection — try signing in again when online';
  return 'Sign-in didn’t finish — try again';
}
const SYNC_LABEL={local:'Not synced',connecting:'Connecting…',synced:'Synced',saving:'Saving…',offline:'Offline — will sync',denied:'Not on the family list',error:'Sync error'};
onStateSaved = ()=>Sync.push();
