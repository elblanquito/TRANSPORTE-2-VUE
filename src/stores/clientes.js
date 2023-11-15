import { defineStore } from "pinia";
import axios from "axios";
import { ref } from "vue";

export const useClienteStore = defineStore("cliente", () => {
  const model = "cliente/";

  const obtener = async () => {
    try {
      const response = await axios.get(`${model}all`);
      return response.data;
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  const buscarxCC = async(cedula)=>{
    try {
      const response = await axios.get(`${model}buscarCC/${cedula}`)
      console.log(response);
      return response.data.cliente
    } catch (error) {
      
    }
  }

  const guardar = async (data) => {
    try {
      const response = await axios.post(`${model}guardar`, data);
      console.log(response);
      return response.data
    } catch (error) {
      console.log(error);
      return error.response.data
    }
  };

  const editar = async (id, data) => {
    try {
      const response = await axios.put(`${model}editar/${id}`, data);
      console.log(response);
      return response.data.cliente
    } catch (error) {
      console.log(error);
      return error.response.data
    }
  };

  const activar = async (id) => {
    try {
      const response = await axios.put(`${model}activar/${id}`);
      console.log(response);
      return response.data.cliente
    } catch (error) {
      console.log(error);
      return null
    }
  };
  
  const inactivar = async (id) => {
    try {
      const response = await axios.put(`${model}inactivar/${id}`);
      console.log(response);
      return response.data.cliente
    } catch (error) {
      console.log(error);
      return null
    }
  };

  return {
    obtener,buscarxCC, guardar, editar, activar, inactivar
  };
});
