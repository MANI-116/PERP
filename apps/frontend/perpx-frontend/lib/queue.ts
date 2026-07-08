 class Node<T>{
  public right:null | Node<T> = null;
  constructor(public data:T){

  }
 }
export class Queue<T>{

  private head:Node<T>|null = null;
  private tail:Node<T>|null = null;
  private length:number = 0;

  constructor(){
  

  }
  enqueue(data:T){
    const node = new Node<T>(data);

    //empty queue
    if(this.head === this.tail && this.head === null){
      this.head = node;
      this.tail = node;
    }else if(this.tail){
    //non empty queue
      this.tail = node;
    }
    this.length++;
  }
  dequeue(){
    const node = this.head;
    if(node === null) return null;
    //no nodes
  
    //single node
    if(this.length === 1){
      this.head = null;
      this.tail = null;
      this.length = 0;
      return node.data
    }
    //multiple nodes
    this.head = node.right;
    node.right = null;
    this.length--;
    return node.data;

  }
 
  clear(){
    this.head = null;
    this.tail = null;
    this.length = 0;

  }
  front(){
    return this.head?.data;
  }

  isEmpty():boolean{
    return this.length === 0;
  }

}


